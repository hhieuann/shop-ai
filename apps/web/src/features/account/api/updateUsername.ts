import { api } from '../../../shared/api/client';
import type { ChangeUsernameRequest, ChangeUsernameResponse } from '../../../shared/api/types';

/**
 * Đổi username của người đang đăng nhập: `PATCH /api/v1/me` (account.md BR-06, #472).
 * Lỗi là ApiError: 409 `USERNAME_TAKEN`, 400 `USERNAME_INVALID` / `USERNAME_REQUIRED` hoặc không `code`, 401
 */
export function updateUsername(username: string): Promise<ChangeUsernameResponse> {
  const body: ChangeUsernameRequest = { username };
  return api.patch<ChangeUsernameResponse>('/me', body);
}
