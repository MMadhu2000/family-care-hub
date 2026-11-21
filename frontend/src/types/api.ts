export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiFailure {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedData<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}