import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/server/admin-db';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';

const bodySchema = z.object({ token: z.string().min(32).max(200) }).strict();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }

    if (!user.email_confirmed_at || !user.email) {
      throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before accepting an invitation.');
    }

    const body = await validateJson(request, bodySchema);

    // The raw token is never logged, returned or stored; only its hash is compared.
    const tokenHash = createHash('sha256').update(body.token).digest('hex');

    const admin = getAdminDb();
    const { data: invitation, error: lookupError } = await admin
      .from('invitations')
      .select('id,family_id,email,role,expires_at,accepted_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (lookupError) throw new ApiError(500, 'INVITATION_LOOKUP_FAILED', 'Unable to process invitation.');
    if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'This invitation is invalid.');

    if (invitation.accepted_at !== null) {
      throw new ApiError(409, 'INVITATION_ALREADY_ACCEPTED', 'This invitation has already been accepted.');
    }
    if (new Date(invitation.expires_at) <= new Date()) {
      throw new ApiError(410, 'INVITATION_EXPIRED', 'This invitation has expired.');
    }
    if (invitation.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new ApiError(403, 'INVITATION_EMAIL_MISMATCH', 'This invitation was sent to a different email address.');
    }

    // The claim and the membership insert are separate operations, not one transaction.
    // A failure after the claim is compensated by restoring accepted_at; this is a documented limitation.
    const { data: claimed, error: claimError } = await admin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
      .is('accepted_at', null)
      .select('id');
    if (claimError) throw new ApiError(500, 'INVITATION_CLAIM_FAILED', 'Unable to accept invitation.');
    if (!claimed || claimed.length !== 1) {
      throw new ApiError(409, 'INVITATION_ALREADY_ACCEPTED', 'This invitation has already been accepted.');
    }

    let role = invitation.role;
    const { error: memberError } = await admin
      .from('family_members')
      .insert({ family_id: invitation.family_id, user_id: user.id, role: invitation.role });

    if (memberError) {
      if (memberError.code === '23505') {
        // Already a member: do not overwrite the existing role. On 23505 the claim stays in place
        // (the user is already a member, so the invitation is consumed).
        const { data: existing, error: existingError } = await admin
          .from('family_members')
          .select('role')
          .eq('family_id', invitation.family_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (existingError || !existing) {
          throw new ApiError(500, 'INVITATION_ACCEPT_FAILED', 'Unable to accept invitation.');
        }
        role = existing.role;
      } else {
        // Compensate the claim; the result is ignored for control flow, but the request must still fail.
        await admin.from('invitations').update({ accepted_at: null }).eq('id', invitation.id);
        throw new ApiError(500, 'INVITATION_ACCEPT_FAILED', 'Unable to accept invitation.');
      }
    }

    return Response.json({ data: { family_id: invitation.family_id, role } }, { status: 200 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
