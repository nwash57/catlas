import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface CachedUrl {
  url: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // In-flight signing requests, keyed by path, so concurrent components asking
  // for the same path don't fan out into duplicate fetches.
  private readonly pending = new Map<string, Promise<string | null>>();
  private readonly cache = new Map<string, CachedUrl>();

  async upload(catId: string, file: File): Promise<{ path: string } | { error: string }> {
    if (!this.isBrowser) return { error: 'Not in browser' };
    const fd = new FormData();
    fd.append('file', file, file.name);

    let res: Response;
    try {
      res = await fetch(`/api/cats/${encodeURIComponent(catId)}/photo`, {
        method: 'POST',
        body: fd,
      });
    } catch (err) {
      return { error: `Network error: ${(err as Error).message}` };
    }
    const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
    if (!res.ok) return { error: body.error ?? `HTTP ${res.status}` };
    if (!body.path) return { error: 'Server returned no path' };
    return { path: body.path };
  }

  async delete(catId: string): Promise<{ ok: true } | { error: string }> {
    if (!this.isBrowser) return { error: 'Not in browser' };
    let res: Response;
    try {
      res = await fetch(`/api/cats/${encodeURIComponent(catId)}/photo`, {
        method: 'DELETE',
      });
    } catch (err) {
      return { error: `Network error: ${(err as Error).message}` };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  }

  async signedUrl(path: string): Promise<string | null> {
    if (!this.isBrowser) return null;

    const now = Date.now();
    const cached = this.cache.get(path);
    if (cached && cached.expiresAt > now) return cached.url;

    const inflight = this.pending.get(path);
    if (inflight) return inflight;

    const promise = (async (): Promise<string | null> => {
      try {
        const res = await fetch(`/api/photos/sign?path=${encodeURIComponent(path)}`);
        if (!res.ok) return null;
        const body = (await res.json()) as { url?: string; expiresIn?: number };
        if (!body.url) return null;
        const ttlMs = (body.expiresIn ?? 3600) * 1000;
        this.cache.set(path, { url: body.url, expiresAt: now + ttlMs - 60_000 });
        return body.url;
      } finally {
        this.pending.delete(path);
      }
    })();

    this.pending.set(path, promise);
    return promise;
  }
}
