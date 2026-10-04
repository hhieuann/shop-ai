/**
 * API client — gọi /api/v1/* bằng đường dẫn tương đối.
 * CloudFront chuyển sang API Gateway → không có CORS.
 * Khi dev local, Vite proxy /api → Prism mock server (localhost:4010).
 */
import { getAccessToken } from '../auth/token';

import type { ChangedItem, FieldError, InvalidItem } from './types';

export type { ChangedItem, FieldError, InvalidItem };

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Lỗi HTTP từ API (RFC 9457 Problem JSON) */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly traceId?: string;
  /** Mã nghiệp vụ, ví dụ OUT_OF_STOCK, PRICE_CHANGED, QUANTITY_LIMIT; xử lý theo mã thay vì đọc chữ */
  readonly code?: string;
  readonly errors: FieldError[];
  readonly invalidItems: InvalidItem[];
  readonly changedItems: ChangedItem[];
  readonly maxAddable?: number;

  constructor(status: number, problem: Record<string, unknown>, fallbackTitle: string) {
    const title = typeof problem.title === 'string' ? problem.title : fallbackTitle;
    super(`${status} ${title}`);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = typeof problem.detail === 'string' ? problem.detail : undefined;
    this.traceId = typeof problem.traceId === 'string' ? problem.traceId : undefined;
    this.code = typeof problem.code === 'string' ? problem.code : undefined;
    this.errors = asArray<FieldError>(problem.errors);
    this.invalidItems = asArray<InvalidItem>(problem.invalidItems);
    this.changedItems = asArray<ChangedItem>(problem.changedItems);
    this.maxAddable = typeof problem.maxAddable === 'number' ? problem.maxAddable : undefined;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  // Chỉ khai báo Content-Type khi thật sự có body
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Gắn token nếu đã đăng nhập; route công khai (catalog) vẫn chạy khi chưa có token
  const token = await getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api/v1${path}`, { ...init, headers });

  if (!res.ok) {
    const problem = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(res.status, problem, res.statusText);
  }

  // 204 No Content hoặc body rỗng
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, init?: Omit<RequestInit, 'method'>) =>
    request<T>(path, { ...init, method: 'GET' }),

  post: <T>(path: string, body: unknown, init?: Omit<RequestInit, 'method' | 'body'>) =>
    request<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown, init?: Omit<RequestInit, 'method' | 'body'>) =>
    request<T>(path, { ...init, method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(path: string, init?: Omit<RequestInit, 'method'>) =>
    request<T>(path, { ...init, method: 'DELETE' }),
};
