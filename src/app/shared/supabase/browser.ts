import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';

let client: SupabaseClient | null | undefined;

export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
    client = null;
    return client;
  }
  client = createBrowserClient(environment.supabaseUrl, environment.supabaseAnonKey);
  return client;
}
