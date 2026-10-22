import { ApiError } from './client';

/** Số lần gọi lại tối đa khi lỗi có thể tự hết (mạng chập chờn, Lambda khởi động chậm, 5xx) */
const MAX_RETRIES = 1;

/** 4xx vẫn nên gọi lại: hết thời gian chờ, gọi quá nhiều */
const RETRYABLE_4XX = new Set([408, 429]);

/**
 * Có gọi lại lệnh lấy dữ liệu không (dùng cho `retry` của TanStack Query).
 * Lỗi 4xx (không tồn tại, chưa đăng nhập, dữ liệu sai) gọi lại vẫn ra đúng lỗi đó,
 * chỉ làm khách chờ thêm, nên báo lỗi ngay. Lỗi 5xx và lỗi mạng gọi lại 1 lần.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return RETRYABLE_4XX.has(error.status);
  }
  return true;
}
