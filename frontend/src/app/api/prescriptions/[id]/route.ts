import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission, assertCareRecipientInFamily } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';

const COLUMNS = 'id,family_id,care_recipient_id,medication_name,dosage,instructions,prescribed_by,start_date,end_date,active,created_by,created_at,updated_at';

const patchSchema = z.object({
  care_recipient_id: z.string().uuid().optional(),
  medication_name: z.string().trim().min(1).max(200).optional(),
  dosage: z.string().trim().max(200).nullable().optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  prescribed_by: z.string().trim().max(200).nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  active: z.boolean().optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

async function readPrescriptionId(context: Ctx) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, 'INVALID_ID', 'Invalid prescription ID.');
  return id;
}

async function loadPrescription(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prescriptions')
    .select('id,family_id,care_recipient_id,start_date,end_date')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ApiError(500, 'PRESCRIPTION_LOOKUP_FAILED', 'Unable to load prescription.');
  if (!data) throw new ApiError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription was not found.');
  return data;
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readPrescriptionId(context);

    const prescription = await loadPrescription(id);
    await requireFamilyPermission(prescription.family_id, 'manage_prescriptions');

    const body = await validateJson(request, patchSchema);
    if (Object.keys(body).length === 0) throw new ApiError(400, 'NO_FIELDS', 'No editable fields were provided.');
    if (typeof body.care_recipient_id === 'string') {
      await assertCareRecipientInFamily(prescription.family_id, body.care_recipient_id);
    }
    const effectiveStart = body.start_date !== undefined ? body.start_date : prescription.start_date;
    const effectiveEnd = body.end_date !== undefined ? body.end_date : prescription.end_date;
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw new ApiError(400, 'INVALID_DATE_RANGE', 'End date cannot be before start date.');
    }

    const updates: Record<string, unknown> = { ...body };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('prescriptions')
      .update(updates)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new ApiError(500, 'PRESCRIPTION_UPDATE_FAILED', 'Unable to update prescription.');
    if (!data) throw new ApiError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription was not found.');

    return Response.json({ data });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readPrescriptionId(context);

    const prescription = await loadPrescription(id);
    await requireFamilyPermission(prescription.family_id, 'delete_prescriptions');

    const supabase = await createClient();
    const { data, error } = await supabase.from('prescriptions').delete().eq('id', id).select('id');
    if (error) throw new ApiError(500, 'PRESCRIPTION_DELETE_FAILED', 'Unable to delete prescription.');
    if (!data || data.length === 0) throw new ApiError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription was not found.');

    return Response.json({ data: { deleted: true } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
