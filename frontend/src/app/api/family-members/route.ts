import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/server/admin-db';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validate } from '@/lib/server/validation';

const familyIdSchema = z.uuid();

const membersFetchFailed = () =>
  new ApiError(
    500,
    'MEMBERS_FETCH_FAILED',
    'Unable to load family members.'
  );

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const user = await requireAuthenticatedUser();

    const familyId = validate(
      familyIdSchema,
      new URL(request.url).searchParams.get('family_id')
    );

    // 2. Check family permissions
    const currentRole = await requireFamilyPermission(
      familyId,
      'view_family'
    );

    // 3. Fetch family memberships
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('family_members')
      .select('id,family_id,user_id,role,created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[FAMILY MEMBERS DEBUG] Membership query failed:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      throw membersFetchFailed();
    }

    if (!rows) {
      console.error('[FAMILY MEMBERS DEBUG] Membership query returned null.');
      throw membersFetchFailed();
    }

    console.log('[FAMILY MEMBERS DEBUG] Membership query successful:', {
      rowCount: rows.length,
    });

    // 4. Initialize Admin client
    const userIds = rows.map((member) => member.user_id);

    const admin = getAdminDb();

    console.log('[FAMILY MEMBERS DEBUG] Admin client initialized.');

    // 5. Fetch profiles and authentication emails
    const [profilesRes, emailResults] = await Promise.all([
      admin
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', userIds),

      Promise.all(
        userIds.map((id) => admin.auth.admin.getUserById(id))
      ),
    ]);

    // 6. Check profile lookup
    console.log('[FAMILY MEMBERS DEBUG] Profile lookup:', {
      error: profilesRes.error?.message ?? null,
      code: profilesRes.error?.code ?? null,
      profileCount: profilesRes.data?.length ?? 0,
    });

    if (profilesRes.error) {
      console.error(
        '[FAMILY MEMBERS DEBUG] Profile lookup failed:',
        profilesRes.error
      );

      throw membersFetchFailed();
    }

    // 7. Check authentication user lookup
    console.log(
      '[FAMILY MEMBERS DEBUG] Auth lookup:',
      emailResults.map((result) => ({
        error: result.error?.message ?? null,
        hasEmail: !!result.data?.user?.email,
      }))
    );

    const emails = emailResults.map((result) => {
      if (result.error) {
        console.error(
          '[FAMILY MEMBERS DEBUG] Auth user lookup failed:',
          result.error.message
        );

        throw membersFetchFailed();
      }

      return result.data.user?.email ?? null;
    });

    // 8. Map profiles to family members
    const profileById = new Map(
      (profilesRes.data ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const members = rows.map((member, index) => {
      const profile = profileById.get(member.user_id);

      return {
        id: member.id,
        family_id: member.family_id,
        user_id: member.user_id,
        role: member.role,
        created_at: member.created_at,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        email: emails[index],
      };
    });

    console.log('[FAMILY MEMBERS DEBUG] Successfully loaded members:', {
      memberCount: members.length,
    });

    // 9. Return response
    return Response.json({
      data: {
        members,
        currentUser: {
          id: user.id,
          role: currentRole,
        },
      },
    });

  } catch (error) {
    console.error('[FAMILY MEMBERS API ERROR]', error);

    return toErrorResponse(error);
  }
}