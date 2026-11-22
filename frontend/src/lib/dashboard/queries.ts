import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';
import { parsePagination } from '@/lib/server/pagination';

const schema = z
  .object({
    family_id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(160),
    date_of_birth: z.string().date().nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .strict();

const COLUMNS = 'id,family_id,full_name,date_of_birth,notes,created_by,created_at,updated_at';

type Row = {
  id: string;
  family_id: string;
  full_name: string;
  date_of_birth: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// Keeps the snake_case fields and adds the camelCase ones the dashboard page reads.
function toRecord(row: Row) {
  return {
    ...row,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    notes: row.notes,
  };
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const familyId = url.searchParams.get('family_id');
    if (!familyId || !z.string().uuid().safeParse(familyId).success) {
      throw new ApiError(400, 'INVALID_FAMILY_ID', 'A valid family_id is required.');
    }
    await requireFamilyPermission(familyId, 'view_family');

    const { page, pageSize } = parsePagination(url.searchParams);
    const supabase = await createClient();

    const { data, error, count } = await supabase
      .from('care_recipients')
      .select(COLUMNS, { count: 'exact' })
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      throw new ApiError(500, 'RECIPIENTS_FETCH_FAILED', 'Unable to load care recipients.');
    }

    return Response.json({
      data: {
        items: ((data ?? []) as Row[]).map(toRecord),
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = await validateJson(request, schema);
    await requireFamilyPermission(body.family_id, 'manage_care_recipients');

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('care_recipients')
      .insert({
        family_id: body.family_id,
        full_name: body.full_name,
        date_of_birth: body.date_of_birth ?? null,
        notes: body.notes ?? null,
        created_by: user.id,
      })
      .select(COLUMNS)
      .single();

    if (error || !data) {
      throw new ApiError(500, 'RECIPIENT_CREATE_FAILED', 'Unable to create care recipient.');
    }

    return Response.json({ data: toRecord(data as Row) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}