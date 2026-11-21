import { ApiError } from '@/lib/server/errors';
import type { PaginationParams } from '@/types/api';

export function parsePagination(
  searchParams: URLSearchParams,
  defaultPageSize = 20,
  maxPageSize = 100,
): PaginationParams {
  const rawPage = searchParams.get('page');
  const rawSize = searchParams.get('pageSize');
  const page = rawPage === null ? 1 : Number(rawPage);
  const pageSize = rawSize === null ? defaultPageSize : Number(rawSize);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > maxPageSize
  ) {
    throw new ApiError(
      400,
      'INVALID_PAGINATION',
      `page must be >= 1 and pageSize must be between 1 and ${maxPageSize}.`,
    );
  }

  return { page, pageSize };
}
