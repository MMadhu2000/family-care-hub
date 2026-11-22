import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { assertCareRecipientInFamily, requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError, toErrorResponse } from '@/lib/server/errors';


const BUCKET = 'medical-records';
const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAuthenticatedUser();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError(400, 'INVALID_UPLOAD', 'A valid multipart file upload is required.');
    }

    const familyId = form.get('family_id');
    const careRecipientId = form.get('care_recipient_id');
    const file = form.get('file');

    if (typeof familyId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(familyId)) {
      throw new ApiError(400, 'INVALID_FAMILY_ID', 'A valid family_id is required.');
    }
    if (typeof careRecipientId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(careRecipientId)) {
      throw new ApiError(400, 'INVALID_CARE_RECIPIENT', 'A valid care_recipient_id is required.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(400, 'FILE_REQUIRED', 'Choose a document to upload.');
    }
    if (file.size < 1 || file.size > MAX_BYTES) {
      throw new ApiError(400, 'INVALID_FILE_SIZE', 'The file must be no larger than 10 MB.');
    }
    const extension = EXTENSION_BY_MIME[file.type];
    if (!extension) {
      throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Only PDF, JPEG, PNG and WebP files are supported.');
    }

    await requireFamilyPermission(familyId, 'manage_records');
    await assertCareRecipientInFamily(familyId, careRecipientId);

    // Use an opaque server-generated object name; never trust the uploaded filename as a path.
    const filePath = `${familyId}/${careRecipientId}/${randomUUID()}.${extension}`;
    const supabase = await createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      contentType: file.type,
      cacheControl: '0',
      upsert: false,
    });

    if (error) {
      throw new ApiError(500, 'FILE_UPLOAD_FAILED', 'Unable to store the medical document.');
    }

    return Response.json({ filePath }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
