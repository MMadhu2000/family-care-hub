import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseEnv, getServiceRoleKey } from '@/lib/server/env';

// Server-only admin client using the service role key (bypasses RLS).
// Never import this from a client component, and never log or return the key.
let adminDb: SupabaseClient | undefined;

export function getAdminDb(): SupabaseClient {
  if (!adminDb) {
    const { url } = getPublicSupabaseEnv();
    adminDb = createClient(url, getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminDb;
}
