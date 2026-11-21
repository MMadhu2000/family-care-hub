import { z } from 'zod';

import { ApiError } from '@/lib/server/errors';

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));

    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Please check the submitted information.',
      details,
    );
  }

  return result.data;
}

export async function validateJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body must contain valid JSON.');
  }

  return validate(schema, body);
}