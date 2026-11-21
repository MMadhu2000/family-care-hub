import type { User } from '@supabase/supabase-js';

import { ApiError } from '@/lib/server/errors';
import { createClient } from '@/lib/supabase/server';

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new ApiError(
      401,
      'UNAUTHENTICATED',
      'You must be signed in to perform this action.',
    );
  }

  return user;
}