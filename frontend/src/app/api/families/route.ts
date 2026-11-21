import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';
import { parsePagination } from '@/lib/server/pagination';

const createSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const supabase = await createClient();
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams);
    const { data, error, count } = await supabase.from('families').select('id,name,created_by,created_at,updated_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page-1)*pageSize, page*pageSize-1);
    if (error) throw new ApiError(500,'FAMILIES_FETCH_FAILED','Unable to load families.');
    return Response.json({ data: { items: data ?? [], page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0)/pageSize) } });
  } catch (e) { return toErrorResponse(e); }
}
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = await validateJson(request, createSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.from('families').insert({ name: body.name, created_by: user.id })
      .select('id,name,created_by,created_at,updated_at').single();
    if (error || !data) throw new ApiError(500,'FAMILY_CREATE_FAILED','Unable to create family.');
    return Response.json({ data }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
