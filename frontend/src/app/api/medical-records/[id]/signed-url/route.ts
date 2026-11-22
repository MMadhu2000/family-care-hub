import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';

const MEDICAL_DOCUMENT_BUCKET = 'medical-records';
const SIGNED_URL_TTL_SECONDS = 60;

type Ctx = { params: Promise<{ id: string }> };

async function readRecordId(context: Ctx) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, 'INVALID_ID', 'Invalid medical record ID.');
  return id;
}

/** The stored path must sit under the record's family folder and contain no ".." segments. */
function isSafeStoragePath(familyId: string, filePath: string): boolean {
  if (!filePath.startsWith(`${familyId}/`)) return false;
  return !filePath.split('/').includes('..');
}

export async function GET(request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readRecordId(context);

    const mode = new URL(request.url).searchParams.get('mode') ?? 'view';
    if (mode !== 'view' && mode !== 'download') {
      throw new ApiError(400, 'INVALID_MODE', 'mode must be view or download.');
    }

    const supabase = await createClient();
    const { data: record, error: lookupError } = await supabase
      .from('medical_records')
      .select('id,family_id,file_path,file_name')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) throw new ApiError(500, 'RECORD_LOOKUP_FAILED', 'Unable to load medical record.');
    if (!record) throw new ApiError(404, 'RECORD_NOT_FOUND', 'Medical record was not found.');

    await requireFamilyPermission(record.family_id, 'view_family');

    if (!isSafeStoragePath(record.family_id, record.file_path)) {
      throw new ApiError(500, 'RECORD_PATH_INVALID', 'This record cannot be opened safely.');
    }

    // Download uses a sanitised name only; the original name is never placed in the URL.
    const safeName = (record.file_name ?? 'document').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);

    const { data, error } = await supabase.storage
      .from(MEDICAL_DOCUMENT_BUCKET)
      .createSignedUrl(
        record.file_path,
        SIGNED_URL_TTL_SECONDS,
        mode === 'download' ? { download: safeName } : undefined,
      );
    if (error || !data?.signedUrl) {
      throw new ApiError(500, 'SIGNED_URL_FAILED', 'Unable to open this document.');
    }

    return Response.json(
      { data: { url: data.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
