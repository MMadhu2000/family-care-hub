import { createClient } from '@/lib/supabase/server';
import { ApiError } from '@/lib/server/errors';

/**
 * Returns the authenticated cookie-scoped Supabase client.
 * Queries through this client are subject to the user's database RLS policies.
 */
export async function createUserDbClient() {
  return createClient();
}

interface DbResult<T> {
  data: T;
  error: { message?: string } | null;
}

/**
 * Checks a Supabase result without exposing raw database error details.
 */
export function unwrapDbResult<T>(result: DbResult<T>): T {
  if (result.error) {
    throw new ApiError(
      500,
      'DATABASE_OPERATION_FAILED',
      'A database operation could not be completed.',
    );
  }

  return result.data;
}