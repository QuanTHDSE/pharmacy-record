import type { ApiSuccess, QueryValue } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = sessionStorage.getItem('pharmacy_access_token');

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) sessionStorage.setItem('pharmacy_access_token', token);
  else sessionStorage.removeItem('pharmacy_access_token');
}

export function hasAccessToken(): boolean {
  return Boolean(accessToken);
}

export function toQuery(values: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/v1${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      'Không thể kết nối máy chủ. Hãy kiểm tra API và kết nối cơ sở dữ liệu.',
      0,
      'NETWORK_ERROR',
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | { success: false; error?: { message?: string; code?: string; details?: unknown } }
    | null;

  if (response.status === 401 && accessToken) {
    setAccessToken(null);
    window.dispatchEvent(new CustomEvent('pharmacy:unauthorized'));
  }

  if (!response.ok || !payload || !payload.success) {
    const error = payload && !payload.success ? payload.error : undefined;
    throw new ApiError(
      error?.message ?? `Yêu cầu thất bại (${response.status}).`,
      response.status,
      error?.code,
      error?.details,
    );
  }

  return payload.data;
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers({ Accept: 'image/jpeg,image/png,image/webp' });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/v1${path}`, { headers });
  } catch {
    throw new ApiError('Không thể tải ảnh từ máy chủ.', 0, 'NETWORK_ERROR');
  }

  if (response.status === 401 && accessToken) {
    setAccessToken(null);
    window.dispatchEvent(new CustomEvent('pharmacy:unauthorized'));
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    throw new ApiError(
      payload?.error?.message ?? `Không thể tải ảnh (${response.status}).`,
      response.status,
      payload?.error?.code,
    );
  }
  return response.blob();
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    return error.details.filter((item): item is string => typeof item === 'string').join(' ');
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
}
