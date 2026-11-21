import { createBrowserClient } from '@supabase/ssr';

import { getPublicSupabaseEnv } from '@/lib/server/env';

export function createClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
