import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission, assertCareRecipientInFamily } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';
import { parsePagination } from '@/lib/server/pagination';

const COLUMNS = 'id,family_id,care_recipient_id,medication_name,dosage,instructions,prescribed_by,start_date,end_date,active,created_by,created_at,updated_at';

const schema = z.object({
  family_id: z.string().uuid(),
  care_recipient_id: z.string().uuid(),
  medication_name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().max(200).nullable().optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  prescribed_by: z.string().trim().max(200).nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  active: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url), familyId = url.searchParams.get('family_id');
    if (!familyId || !z.string().uuid().safeParse(familyId).success) throw new ApiError(400, 'INVALID_FAMILY_ID', 'A valid family_id is required.');
    await requireFamilyPermission(familyId, 'view_family');
    const { page, pageSize } = parsePagination(url.searchParams), supabase = await createClient();
    let query = supabase.from('prescriptions').select(COLUMNS, { count: 'exact' }).eq('family_id', familyId);
    const recipientId = url.searchParams.get('care_recipient_id');
    if (recipientId) {
      if (!z.string().uuid().safeParse(recipientId).success) throw new ApiError(400, 'INVALID_CARE_RECIPIENT', 'care_recipient_id must be a valid UUID.');
      query = query.eq('care_recipient_id', recipientId);
    }
    const { data, error, count } = await query
      .order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new ApiError(500, 'PRESCRIPTIONS_FETCH_FAILED', 'Unable to load prescriptions.');
    return Response.json({ data: { items: data ?? [], page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) } });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(), body = await validateJson(request, schema);
    await requireFamilyPermission(body.family_id, 'manage_prescriptions');
    await assertCareRecipientInFamily(body.family_id, body.care_recipient_id);
    if (body.start_date && body.end_date && body.end_date < body.start_date) throw new ApiError(400, 'INVALID_DATE_RANGE', 'End date cannot be before start date.');
    const supabase = await createClient();
    const { data, error } = await supabase.from('prescriptions').insert({
      family_id: body.family_id,
      care_recipient_id: body.care_recipient_id,
      medication_name: body.medication_name,
      dosage: body.dosage ?? null,
      instructions: body.instructions ?? null,
      prescribed_by: body.prescribed_by ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      active: body.active ?? true,
      created_by: user.id,
    }).select(COLUMNS).single();
    if (error || !data) throw new ApiError(500, 'PRESCRIPTION_CREATE_FAILED', 'Unable to create prescription.');
    return Response.json({ data }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
