import type { ApiSuccess } from './types';

const baseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://pharmacy-record.onrender.com/api'
).replace(/\/$/, '');
let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function attachmentUrl(recordId: string, attachmentId: string): string {
  return `${baseUrl}/v1/medical-records/${recordId}/attachments/${attachmentId}`;
}

export function query(values: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Không thể kết nối máy chủ. Hãy kiểm tra Internet và API.', 0);
  }

  if (response.status === 401 && accessToken) unauthorizedHandler?.();

  const payload = (await response.json().catch(() => null)) as
    ApiSuccess<T> | { success: false; error?: { message?: string; details?: unknown } } | null;
  if (!response.ok || !payload || !payload.success) {
    const error = payload && !payload.success ? payload.error : undefined;
    const details = error?.details;
    const message =
      Array.isArray(details) && details.every((value) => typeof value === 'string')
        ? details.join(' ')
        : (error?.message ?? `Yêu cầu thất bại (${response.status}).`);
    throw new ApiError(message, response.status);
  }
  return payload.data;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
}
