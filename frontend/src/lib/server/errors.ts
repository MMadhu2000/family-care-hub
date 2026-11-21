export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode },
    );
  }

  return Response.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
    { status: 500 },
  );
}