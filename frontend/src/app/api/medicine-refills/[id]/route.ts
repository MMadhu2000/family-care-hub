import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';

const COLUMNS = 'id,prescription_id,due_at,completed_at,status,created_at';

const patchSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

async function readRefillId(context: Ctx) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, 'INVALID_ID', 'Invalid medicine refill ID.');
  return id;
}

async function loadRefill(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('medicine_refills')
    .select('id,prescription_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ApiError(500, 'REFILL_LOOKUP_FAILED', 'Unable to load medicine refill.');
  if (!data) throw new ApiError(404, 'REFILL_NOT_FOUND', 'Medicine refill was not found.');
  return data;
}

async function loadParentFamilyId(prescriptionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prescriptions')
    .select('id,family_id')
    .eq('id', prescriptionId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'PRESCRIPTION_LOOKUP_FAILED', 'Unable to load prescription.');
  if (!data) throw new ApiError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription was not found.');
  return data.family_id;
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readRefillId(context);

    const refill = await loadRefill(id);
    const familyId = await loadParentFamilyId(refill.prescription_id);
    await requireFamilyPermission(familyId, 'manage_prescriptions');

    const body = await validateJson(request, patchSchema);
    if (Object.keys(body).length === 0) throw new ApiError(400, 'NO_FIELDS', 'No editable fields were provided.');
    const completedAt = body.status === 'COMPLETED' ? new Date().toISOString() : null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('medicine_refills')
      .update({ status: body.status, completed_at: completedAt })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new ApiError(500, 'REFILL_UPDATE_FAILED', 'Unable to update medicine refill.');
    if (!data) throw new ApiError(404, 'REFILL_NOT_FOUND', 'Medicine refill was not found.');

    return Response.json({ data });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readRefillId(context);

    const refill = await loadRefill(id);
    const familyId = await loadParentFamilyId(refill.prescription_id);
    await requireFamilyPermission(familyId, 'delete_prescriptions');

    const supabase = await createClient();
    const { data, error } = await supabase.from('medicine_refills').delete().eq('id', id).select('id');
    if (error) throw new ApiError(500, 'REFILL_DELETE_FAILED', 'Unable to delete medicine refill.');
    if (!data || data.length === 0) throw new ApiError(404, 'REFILL_NOT_FOUND', 'Medicine refill was not found.');

    return Response.json({ data: { deleted: true } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
