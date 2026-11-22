import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/server/admin-db';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validate } from '@/lib/server/validation';

const familyIdSchema = z.uuid();

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    console.log('[FAMILY MEMBERS] Starting authentication');

    const user = await requireAuthenticatedUser();

    console.log('[FAMILY MEMBERS] Authentication successful');

    // 2. Validate family ID
    const familyId = validate(
      familyIdSchema,
      new URL(request.url).searchParams.get('family_id')
    );

    // 3. Verify family permission
    console.log('[FAMILY MEMBERS] Checking family permission');

    const currentRole = await requireFamilyPermission(
      familyId,
      'view_family'
    );

    console.log('[FAMILY MEMBERS] Permission verified:', currentRole);

    // 4. Fetch family memberships
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('family_members')
      .select('id,family_id,user_id,role,created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[FAMILY MEMBERS] Membership query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
      });

      throw new ApiError(
        500,
        'MEMBERSHIP_FETCH_FAILED',
        'Unable to retrieve family memberships.'
      );
    }

    const members = rows ?? [];

    console.log('[FAMILY MEMBERS] Memberships retrieved:', members.length);

    // 5. Return an empty list if there are no memberships
    if (members.length === 0) {
      return Response.json({
        data: {
          members: [],
          currentUser: {
            id: user.id,
            role: currentRole,
          },
        },
      });
    }

    // 6. Fetch optional profile information
    const userIds = members.map((member) => member.user_id);

    let profileById = new Map<
      string,
      { display_name: string | null; avatar_url: string | null }
    >();

    try {
      const admin = getAdminDb();

      console.log('[FAMILY MEMBERS] Admin client initialized');

      const { data: profiles, error: profileError } = await admin
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', userIds);

      if (profileError) {
        console.error('[FAMILY MEMBERS] Profile lookup error:', {
          message: profileError.message,
          code: profileError.code,
        });
      } else {
        profileById = new Map(
          (profiles ?? []).map((profile) => [
            profile.id,
            {
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
            },
          ])
        );
      }
    } catch (profileError) {
      console.error('[FAMILY MEMBERS] Optional profile lookup failed:', profileError);
    }

    // 7. Fetch emails separately; missing email data must not break the dashboard
    let emailById = new Map<string, string | null>();

    try {
      const admin = getAdminDb();

      const emailResults = await Promise.all(
        userIds.map(async (id) => {
          const { data, error } = await admin.auth.admin.getUserById(id);

          if (error) {
            console.error('[FAMILY MEMBERS] Email lookup failed:', {
              userId: id,
              message: error.message,
            });

            return [id, null] as const;
          }

          return [id, data.user?.email ?? null] as const;
        })
      );

      emailById = new Map(emailResults);
    } catch (emailError) {
      console.error('[FAMILY MEMBERS] Optional email lookup failed:', emailError);
    }

    // 8. Combine membership, profile and email information
    const result = members.map((member) => {
      const profile = profileById.get(member.user_id);

      return {
        id: member.id,
        family_id: member.family_id,
        user_id: member.user_id,
        role: member.role,
        created_at: member.created_at,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        email: emailById.get(member.user_id) ?? null,
      };
    });

    console.log('[FAMILY MEMBERS] Successfully loaded:', result.length);

    // 9. Return response
    return Response.json({
      data: {
        members: result,
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