import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';

const ROLES = ['ADMIN', 'CAREGIVER', 'CONTRIBUTOR', 'VIEWER'] as const;
const patchSchema = z.object({ role: z.enum(ROLES) }).strict();
const lastAdminError = () => new ApiError(409, 'LAST_ADMIN', 'A family must keep at least one ADMIN.');
const notFound = () => new ApiError(404, 'MEMBER_NOT_FOUND', 'Family member was not found.');
const lookupFailed = () => new ApiError(500, 'MEMBER_LOOKUP_FAILED', 'Unable to load family member.');

type Ctx = { params: Promise<{ id: string }> };
type Client = Awaited<ReturnType<typeof createClient>>;

async function loadTarget(s: Client, memberId: string) {
  const { data, error } = await s
    .from('family_members')
    .select('id,family_id,user_id,role')
    .eq('id', memberId)
    .maybeSingle();
  if (error) throw lookupFailed();
  if (!data) throw notFound();
  return data;
}

async function countAdmins(s: Client, familyId: string) {
  const { count, error } = await s
    .from('family_members')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('role', 'ADMIN');
  if (error) throw lookupFailed();
  return count ?? 0;
}

async function readMemberId(context: Ctx) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'INVALID_ID', 'Invalid family member ID.');
  return id;
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const memberId = await readMemberId(context);
    const body = await validateJson(request, patchSchema);

    const s = await createClient();
    const target = await loadTarget(s, memberId);
    await requireFamilyPermission(target.family_id, 'manage_members');

    if (target.role === 'ADMIN' && body.role !== 'ADMIN' && (await countAdmins(s, target.family_id)) <= 1) {
      throw lastAdminError();
    }

    const { data, error } = await s
      .from('family_members')
      .update({ role: body.role })
      .eq('id', memberId)
      .select('id,family_id,user_id,role,created_at')
      .maybeSingle();
    if (error) throw new ApiError(500, 'MEMBER_UPDATE_FAILED', 'Unable to update family member.');
    if (!data) throw notFound();

    return Response.json({ data });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireAuthenticatedUser();
    const memberId = await readMemberId(context);

    const s = await createClient();
    const target = await loadTarget(s, memberId);
    if (target.user_id !== user.id) {
      await requireFamilyPermission(target.family_id, 'manage_members');
    }

    if (target.role === 'ADMIN' && (await countAdmins(s, target.family_id)) <= 1) {
      throw lastAdminError();
    }

    const { data, error } = await s.from('family_members').delete().eq('id', memberId).select('id');
    if (error) throw new ApiError(500, 'MEMBER_DELETE_FAILED', 'Unable to remove family member.');
    if (!data || data.length === 0) throw notFound();

    return Response.json({ data: { deleted: true } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
