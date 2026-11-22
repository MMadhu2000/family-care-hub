import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';

type Ctx = { params: Promise<{ id: string }> };

async function readInvitationId(context: Ctx) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'INVALID_ID', 'Invalid invitation ID.');
  return id;
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const invitationId = await readInvitationId(context);

    const supabase = await createClient();
    const { data: invitation, error: lookupError } = await supabase
      .from('invitations')
      .select('id,family_id')
      .eq('id', invitationId)
      .maybeSingle();
    if (lookupError) throw new ApiError(500, 'INVITATION_LOOKUP_FAILED', 'Unable to load invitation.');
    // RLS hides invitations from non-admins of other families, so a miss covers them too.
    if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation was not found.');

    await requireFamilyPermission(invitation.family_id, 'manage_members');

    const { data, error } = await supabase.from('invitations').delete().eq('id', invitationId).select('id');
    if (error) throw new ApiError(500, 'INVITATION_DELETE_FAILED', 'Unable to revoke invitation.');
    if (!data || data.length === 0) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation was not found.');

    return Response.json({ data: { deleted: true } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
