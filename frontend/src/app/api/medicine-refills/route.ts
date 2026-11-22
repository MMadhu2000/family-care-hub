import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';
import { parsePagination } from '@/lib/server/pagination';

const COLUMNS = 'id,prescription_id,due_at,completed_at,status,created_at';

const createSchema = z.object({
  prescription_id: z.string().uuid(),
  due_at: z.string().datetime(),
}).strict();

async function loadPrescription(prescriptionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prescriptions')
    .select('id,family_id')
    .eq('id', prescriptionId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'PRESCRIPTION_LOOKUP_FAILED', 'Unable to load prescription.');
  if (!data) throw new ApiError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription was not found.');
  return data;
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const prescriptionId = url.searchParams.get('prescription_id');
    if (!prescriptionId || !z.string().uuid().safeParse(prescriptionId).success) {
      throw new ApiError(400, 'INVALID_PRESCRIPTION_ID', 'A valid prescription_id is required.');
    }
    const prescription = await loadPrescription(prescriptionId);
    await requireFamilyPermission(prescription.family_id, 'view_family');

    const { page, pageSize } = parsePagination(url.searchParams);
    const supabase = await createClient();
    const { data, error, count } = await supabase
      .from('medicine_refills')
      .select(COLUMNS, { count: 'exact' })
      .eq('prescription_id', prescriptionId)
      .order('due_at', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new ApiError(500, 'REFILLS_FETCH_FAILED', 'Unable to load medicine refills.');
    return Response.json({ data: { items: data ?? [], page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) } });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await validateJson(request, createSchema);
    const prescription = await loadPrescription(body.prescription_id);
    await requireFamilyPermission(prescription.family_id, 'manage_prescriptions');

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('medicine_refills')
      .insert({ prescription_id: body.prescription_id, due_at: body.due_at })
      .select(COLUMNS)
      .single();
    if (error || !data) throw new ApiError(500, 'REFILL_CREATE_FAILED', 'Unable to create medicine refill.');
    return Response.json({ data }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
