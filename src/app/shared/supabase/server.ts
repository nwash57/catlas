import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parse, serialize } from 'cookie';
import type { Request, Response } from 'express';

export function supabaseServer(req: Request, res: Response): SupabaseClient {
  const url = process.env['SUPABASE_URL'];
  const anonKey = process.env['SUPABASE_ANON_KEY'];
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set for the SSR server.');
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const header = req.headers.cookie ?? '';
        const jar = parse(header);
        return Object.entries(jar).map(([name, value]) => ({ name, value: value ?? '' }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          res.appendHeader('Set-Cookie', serialize(name, value, options));
        }
      },
    },
  });
}
