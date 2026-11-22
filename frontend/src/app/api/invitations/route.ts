import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validate, validateJson } from '@/lib/server/validation';

const INVITE_ROLES = ['CAREGIVER', 'CONTRIBUTOR', 'VIEWER'] as const;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
const bodySchema = z
  .object({
    family_id: z.uuid(),
    email: emailSchema,
    role: z.enum(INVITE_ROLES),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = await validateJson(request, bodySchema);
    await requireFamilyPermission(body.family_id, 'manage_members');

    // The raw token is returned only in this response and is never stored; only its hash is persisted.
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        family_id: body.family_id,
        email: body.email,
        role: body.role,
        token_hash: tokenHash,
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .select('id,family_id,email,role,expires_at,accepted_at,created_at')
      .single();
    if (error) throw new ApiError(500, 'INVITATION_CREATE_FAILED', 'Unable to create invitation.');

    return Response.json(
      {
        data: {
          invitation: data,
          invitationUrl: `${new URL(request.url).origin}/invitations/accept?token=${rawToken}`,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const familyId = validate(z.uuid(), new URL(request.url).searchParams.get('family_id') ?? undefined);
    await requireFamilyPermission(familyId, 'manage_members');

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invitations')
      .select('id,family_id,email,role,expires_at,created_at')
      .eq('family_id', familyId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, 'INVITATIONS_FETCH_FAILED', 'Unable to load invitations.');

    return Response.json({ data: { items: data ?? [] } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
