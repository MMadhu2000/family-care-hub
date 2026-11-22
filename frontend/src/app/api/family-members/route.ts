import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/server/admin-db';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validate } from '@/lib/server/validation';

const familyIdSchema = z.uuid();

const membersFetchFailed = () => new ApiError(500, 'MEMBERS_FETCH_FAILED', 'Unable to load family members.');

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const familyId = validate(familyIdSchema, new URL(request.url).searchParams.get('family_id'));
    const currentRole = await requireFamilyPermission(familyId, 'view_family');

    const s = await createClient();
    const { data: rows, error } = await s
      .from('family_members')
      .select('id,family_id,user_id,role,created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });
    if (error || !rows) throw membersFetchFailed();

    const userIds = rows.map((m) => m.user_id);
    const admin = getAdminDb();
    const [profilesRes, emailResults] = await Promise.all([
      admin.from('profiles').select('id,display_name,avatar_url').in('id', userIds),
      Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id))),
    ]);
    if (profilesRes.error) throw membersFetchFailed();

    const profileById = new Map(
      (profilesRes.data ?? []).map((p): [string, (typeof profilesRes.data)[number]] => [p.id, p]),
    );
    const emails = emailResults.map((r) => {
      if (r.error) throw membersFetchFailed();
      return r.data.user?.email ?? null;
    });

    const members = rows.map((m, i) => {
      const profile = profileById.get(m.user_id);
      return {
        id: m.id,
        family_id: m.family_id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        email: emails[i],
      };
    });

    return Response.json({ data: { members, currentUser: { id: user.id, role: currentRole } } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
