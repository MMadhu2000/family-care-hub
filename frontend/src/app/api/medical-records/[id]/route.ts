import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';

const MEDICAL_DOCUMENT_BUCKET = 'medical-records';

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

export async function DELETE(request: Request, context: Ctx) {
  try {
    await requireAuthenticatedUser();
    const id = await readRecordId(context);

    const familyIdParam = new URL(request.url).searchParams.get('family_id');
    if (!familyIdParam || !z.string().uuid().safeParse(familyIdParam).success) {
      throw new ApiError(400, 'INVALID_FAMILY_ID', 'A valid family_id is required.');
    }

    const supabase = await createClient();
    const { data: record, error: lookupError } = await supabase
      .from('medical_records')
      .select('id,family_id,file_path')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) throw new ApiError(500, 'RECORD_LOOKUP_FAILED', 'Unable to load medical record.');
    if (!record) throw new ApiError(404, 'RECORD_NOT_FOUND', 'Medical record was not found.');
    // Same response whether the record is missing or belongs to another family.
    if (record.family_id !== familyIdParam) throw new ApiError(404, 'RECORD_NOT_FOUND', 'Medical record was not found.');

    await requireFamilyPermission(record.family_id, 'delete_records');

    if (!isSafeStoragePath(record.family_id, record.file_path)) {
      throw new ApiError(500, 'RECORD_PATH_INVALID', 'This record cannot be deleted safely.');
    }

    // Delete the database row first, so a failure never leaves a visible record whose file is gone.
    // If the row is removed but the file removal below fails, the only leftover is an orphaned file,
    // which is reported to the user rather than returned as success.
    const { data: deletedRows, error: deleteError } = await supabase
      .from('medical_records')
      .delete()
      .eq('id', id)
      .select('id');
    if (deleteError) throw new ApiError(500, 'RECORD_DELETE_FAILED', 'Unable to delete medical record.');
    if (!deletedRows || deletedRows.length === 0) {
      throw new ApiError(404, 'RECORD_NOT_FOUND', 'Medical record was not found.');
    }

    let fileRemoveFailed = false;
    try {
      const { error: removeError } = await supabase.storage
        .from(MEDICAL_DOCUMENT_BUCKET)
        .remove([record.file_path]);
      fileRemoveFailed = Boolean(removeError);
    } catch {
      fileRemoveFailed = true;
    }
    if (fileRemoveFailed) {
      throw new ApiError(
        500,
        'RECORD_FILE_DELETE_FAILED',
        'The record was removed, but its file could not be deleted. Ask an administrator to clean up the stored file.',
      );
    }

    return Response.json({ data: { deleted: true } });
  } catch (e) {
    return toErrorResponse(e);
  }
}
