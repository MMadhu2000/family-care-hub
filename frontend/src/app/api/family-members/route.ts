import { z } from 'zod';
import { getAdminDb } from '@/lib/server/admin-db';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validate } from '@/lib/server/validation';

const familyIdSchema = z.string().uuid();

type Profile = { display_name: string | null; avatar_url: string | null };

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const user = await requireAuthenticatedUser();

    // 2. Validate family ID
    const familyId = validate(
      familyIdSchema,
      new URL(request.url).searchParams.get('family_id')
    );

    // 3. Verify family permission
    const currentRole = await requireFamilyPermission(familyId, 'view_family');

    // 4. Fetch family memberships (admin client: permission already verified above)
    const admin = getAdminDb();

    const { data: rows, error } = await admin
      .from('family_members')
      .select('id,family_id,user_id,role,created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[FAMILY MEMBERS] Membership query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      throw new ApiError(
        500,
        'MEMBERSHIP_FETCH_FAILED',
        'Unable to retrieve family memberships.'
      );
    }

    const members = rows ?? [];

    // 5. Return an empty list if there are no memberships
    if (members.length === 0) {
      return Response.json({
        data: {
          members: [],
          currentUser: { id: user.id, role: currentRole },
        },
      });
    }

    const userIds = members.map((member) => member.user_id);

    // 6 + 7. Fetch profiles and emails in parallel; failures here must not break the dashboard
    const [profileById, emailById] = await Promise.all([
      (async () => {
        const map = new Map<string, Profile>();
        try {
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
            for (const p of profiles ?? []) {
              map.set(p.id, {
                display_name: p.display_name,
                avatar_url: p.avatar_url,
              });
            }
          }
        } catch (e) {
          console.error('[FAMILY MEMBERS] Optional profile lookup failed:', e);
        }
        return map;
      })(),

      (async () => {
        const map = new Map<string, string | null>();
        try {
          const results = await Promise.all(
            userIds.map(async (id) => {
              const { data, error: emailError } =
                await admin.auth.admin.getUserById(id);

              if (emailError) {
                console.error('[FAMILY MEMBERS] Email lookup failed:', {
                  userId: id,
                  message: emailError.message,
                });
                return [id, null] as const;
              }

              return [id, data.user?.email ?? null] as const;
            })
          );
          for (const [id, email] of results) map.set(id, email);
        } catch (e) {
          console.error('[FAMILY MEMBERS] Optional email lookup failed:', e);
        }
        return map;
      })(),
    ]);

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

    // 9. Return response
    return Response.json({
      data: {
        members: result,
        currentUser: { id: user.id, role: currentRole },
      },
    });
  } catch (error) {
    console.error('[FAMILY MEMBERS API ERROR]', error);
    return toErrorResponse(error);
  }
}