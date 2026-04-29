import { randomUUID } from 'node:crypto';
import busboy from 'busboy';
import type { Express, Request, Response } from 'express';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseServiceRole } from '../app/shared/supabase/service-role';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_INBOUND_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface UploadedFile {
  bytes: Buffer;
  mime: string;
  filename: string;
}

// Read a single multipart file from the request, capped at MAX_PHOTO_BYTES.
// Resolves null if no file was sent. Rejects on disallowed mime / overflow.
function readSingleFile(req: Request): Promise<UploadedFile | null> {
  return new Promise((resolve, reject) => {
    let bb: ReturnType<typeof busboy>;
    try {
      bb = busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: MAX_PHOTO_BYTES },
      });
    } catch (err) {
      reject(err);
      return;
    }

    let result: UploadedFile | null = null;
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    bb.on('file', (_name, stream, info) => {
      if (!ALLOWED_INBOUND_MIME.has(info.mimeType)) {
        stream.resume();
        settle(() => reject(new Error('UNSUPPORTED_MIME')));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => {
        settle(() => reject(new Error('TOO_LARGE')));
      });
      stream.on('end', () => {
        if (settled) return;
        result = {
          bytes: Buffer.concat(chunks),
          mime: info.mimeType,
          filename: info.filename,
        };
      });
    });

    bb.on('error', (err) => settle(() => reject(err)));
    bb.on('finish', () => settle(() => resolve(result)));

    req.pipe(bb);
  });
}

async function requireAuthedManager(
  sb: SupabaseClient,
  catId: string,
): Promise<
  | { ok: true; colonyId: string; oldPath: string | null }
  | { ok: false; status: number; message: string }
> {
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user?.id) return { ok: false, status: 401, message: 'Not authenticated' };

  // RLS on `cats` already restricts SELECT to active members. Non-members get nothing.
  const { data: catRow, error: catErr } = await sb
    .from('cats')
    .select('id, colony_id, photo_path')
    .eq('id', catId)
    .maybeSingle();
  if (catErr) return { ok: false, status: 500, message: 'Lookup failed' };
  if (!catRow) return { ok: false, status: 404, message: 'Cat not found' };

  const { data: managerCheck, error: rpcErr } = await sb.rpc('is_colony_manager', {
    colony: catRow.colony_id,
  });
  if (rpcErr) return { ok: false, status: 500, message: 'Permission check failed' };
  if (!managerCheck) return { ok: false, status: 403, message: 'Forbidden' };

  return {
    ok: true,
    colonyId: catRow.colony_id as string,
    oldPath: (catRow.photo_path as string | null) ?? null,
  };
}

export function registerCatPhotoRoutes(app: Express): void {
  // Upload: manager-only, EXIF-stripped via sharp re-encode.
  app.post('/api/cats/:catId/photo', async (req: Request, res: Response) => {
    const sb = res.locals['supabase'] as SupabaseClient | undefined;
    if (!sb) return res.status(503).json({ error: 'Supabase not configured' });

    const catId = String(req.params['catId']);
    const auth = await requireAuthedManager(sb, catId);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

    let uploaded: UploadedFile | null;
    try {
      uploaded = await readSingleFile(req);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'TOO_LARGE') return res.status(413).json({ error: 'File too large (max 8MB)' });
      if (msg === 'UNSUPPORTED_MIME')
        return res.status(415).json({ error: 'Only JPEG, PNG, or WebP' });
      return res.status(400).json({ error: 'Invalid upload' });
    }
    if (!uploaded) return res.status(400).json({ error: 'No file provided' });

    // sharp().rotate() bakes in the EXIF orientation, then JPEG re-encode strips
    // ALL metadata (EXIF, GPS, ICC, XMP). This is the privacy boundary for photos.
    let stripped: Buffer;
    try {
      stripped = await sharp(uploaded.bytes)
        .rotate()
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      return res.status(400).json({ error: 'Could not process image' });
    }

    const newPath = `${auth.colonyId}/${catId}/${randomUUID()}.jpg`;
    const sr = supabaseServiceRole();

    const { error: uploadErr } = await sr.storage
      .from('cat-photos')
      .upload(newPath, stripped, { contentType: 'image/jpeg', upsert: false });
    if (uploadErr) return res.status(500).json({ error: 'Storage upload failed' });

    const { error: updateErr } = await sr
      .from('cats')
      .update({ photo_path: newPath })
      .eq('id', catId);
    if (updateErr) {
      await sr.storage.from('cat-photos').remove([newPath]).catch(() => {});
      return res.status(500).json({ error: 'Could not save path' });
    }

    if (auth.oldPath && auth.oldPath !== newPath) {
      await sr.storage.from('cat-photos').remove([auth.oldPath]).catch(() => {});
    }

    return res.json({ path: newPath });
  });

  // Delete photo: manager-only.
  app.delete('/api/cats/:catId/photo', async (req: Request, res: Response) => {
    const sb = res.locals['supabase'] as SupabaseClient | undefined;
    if (!sb) return res.status(503).json({ error: 'Supabase not configured' });

    const catId = String(req.params['catId']);
    const auth = await requireAuthedManager(sb, catId);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

    const sr = supabaseServiceRole();
    const { error: updateErr } = await sr
      .from('cats')
      .update({ photo_path: null })
      .eq('id', catId);
    if (updateErr) return res.status(500).json({ error: 'Could not clear path' });

    if (auth.oldPath) {
      await sr.storage.from('cat-photos').remove([auth.oldPath]).catch(() => {});
    }
    return res.json({ ok: true });
  });

  // Signed URL: anon if cat's colony is_public; otherwise active members only.
  app.get('/api/photos/sign', async (req: Request, res: Response) => {
    const path = String(req.query['path'] ?? '');
    if (!path) return res.status(400).json({ error: 'path required' });

    const sr = supabaseServiceRole();

    // Lookup the owning cat + colony privacy flag. Service role bypasses RLS;
    // we do our own authorization below.
    const { data: catRow, error: catErr } = await sr
      .from('cats')
      .select('id, colony_id, colonies!inner(is_public)')
      .eq('photo_path', path)
      .maybeSingle();
    if (catErr) return res.status(500).json({ error: 'Lookup failed' });
    if (!catRow) return res.status(404).json({ error: 'Not found' });

    const colonies = (catRow as { colonies: { is_public: boolean } | { is_public: boolean }[] })
      .colonies;
    const isPublicColony = Array.isArray(colonies) ? colonies[0]?.is_public : colonies.is_public;

    if (!isPublicColony) {
      const sb = res.locals['supabase'] as SupabaseClient | undefined;
      if (!sb) return res.status(403).json({ error: 'Members only' });

      const { data: userData } = await sb.auth.getUser();
      if (!userData.user?.id) return res.status(403).json({ error: 'Members only' });

      const { data: memberCheck } = await sb.rpc('is_active_member', {
        colony: catRow.colony_id,
      });
      if (!memberCheck) return res.status(403).json({ error: 'Members only' });
    }

    const { data: signed, error: signErr } = await sr.storage
      .from('cat-photos')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed) return res.status(500).json({ error: 'Could not sign' });

    // Cache hint matches the TTL so browsers don't re-fetch within window.
    res.setHeader('Cache-Control', `private, max-age=${SIGNED_URL_TTL_SECONDS - 60}`);
    return res.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
  });
}
