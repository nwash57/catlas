import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only. Never import from anything that ships to the browser.
// The service-role key bypasses RLS, so the caller must do its own
// authorization before using this client.
let cached: SupabaseClient | null = null;

export function supabaseServiceRole(): SupabaseClient {
  if (cached) return cached;
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the SSR server.',
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
