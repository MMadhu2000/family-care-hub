import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';

const patchSchema = z.object({
  full_name: z.string().trim().min(1).max(160).optional(),
  date_of_birth: z.string().date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

async function readRecipientId(context: Ctx) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid care recipient ID.');
  return id;
}

async function loadRecipient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('care_recipients')
    .select('id,family_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ApiError(500, 'RECIPIENT_LOOKUP_FAILED', 'Unable to load care recipient.');
  if (!data) throw new ApiError(404, 'RECIPIENT_NOT_FOUND', 'Care recipient was not found.');
  return data;
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readRecipientId(context);
    const body = await validateJson(request, patchSchema);
    if (Object.keys(body).length === 0) throw new ApiError(400, 'NO_FIELDS', 'No editable fields were provided.');

    const recipient = await loadRecipient(id);
    await requireFamilyPermission(recipient.family_id, 'manage_care_recipients');

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.full_name !== undefined) updates.full_name = body.full_name;
    if (body.date_of_birth !== undefined) updates.date_of_birth = body.date_of_birth;
    if (body.notes !== undefined) updates.notes = body.notes;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('care_recipients')
      .update(updates)
      .eq('id', id)
      .select('id,family_id,full_name,date_of_birth,notes,created_by,created_at,updated_at')
      .maybeSingle();
    if (error) throw new ApiError(500, 'RECIPIENT_UPDATE_FAILED', 'Unable to update care recipient.');
    if (!data) throw new ApiError(404, 'RECIPIENT_NOT_FOUND', 'Care recipient was not found.');

    return Response.json({ data });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readRecipientId(context);

    const recipient = await loadRecipient(id);
    await requireFamilyPermission(recipient.family_id, 'delete_care_recipients');

    const supabase = await createClient();
    const { data, error } = await supabase.from('care_recipients').delete().eq('id', id).select('id');
    if (error) throw new ApiError(500, 'RECIPIENT_DELETE_FAILED', 'Unable to delete care recipient.');
    if (!data || data.length === 0) throw new ApiError(404, 'RECIPIENT_NOT_FOUND', 'Care recipient was not found.');

    return Response.json({ data: { deleted: true } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
