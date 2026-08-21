// ==============================================================================
// PropertyOS Standard API Response Types
// ==============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorResponse;
  meta?: ApiMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  requestId?: string;
  timestamp: string;
}

export interface ApiMeta {
  requestId?: string;
  timestamp?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  pagination?: ApiPaginationMeta;
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
