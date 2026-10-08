import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { shouldRetry } from './retry';

const apiError = (status: number) => new ApiError(status, {}, 'Lỗi');

describe('shouldRetry', () => {
  it.each([400, 401, 403, 404, 409, 422])('không gọi lại khi lỗi %i', (status) => {
    expect(shouldRetry(0, apiError(status))).toBe(false);
  });

  it.each([408, 429, 500, 502, 503])('gọi lại 1 lần khi lỗi %i', (status) => {
    expect(shouldRetry(0, apiError(status))).toBe(true);
  });

  it('gọi lại 1 lần khi lỗi mạng', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true);
  });

  it('đã gọi lại 1 lần thì dừng', () => {
    expect(shouldRetry(1, apiError(503))).toBe(false);
    expect(shouldRetry(1, new TypeError('Failed to fetch'))).toBe(false);
  });
});
