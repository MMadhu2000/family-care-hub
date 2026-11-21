import { createClient } from '@/lib/supabase/server';
import { ApiError } from '@/lib/server/errors';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return { id: data.user.id, email: data.user.email ?? undefined };
}
