import { BadRequestError, ConflictError } from '../../../shared/errors.js';
import { validateUsername } from '../domain/username.js';
import type { UsernameStore } from '../ports.js';

const MESSAGES = {
  USERNAME_REQUIRED: 'Cần nhập username',
  USERNAME_INVALID: 'Username 3–20 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới',
} as const;

/**
 * Đổi username (account.md BR-06): cùng luật và không trùng như lúc đăng ký (checkSignUp).
 * Đổi sang đúng tên đang dùng thì coi như xong, không báo trùng.
 * Hai người cùng đổi sang một tên trong cùng lúc vẫn có thể trùng, chấp nhận như lúc đăng ký.
 */
export async function changeUsername(
  deps: { readonly users: UsernameStore },
  /** username lấy thẳng từ body nên chưa biết kiểu */
  input: { readonly userId: string; readonly username: unknown },
): Promise<{ readonly username: string }> {
  const raw = input.username ?? undefined; // null coi như thiếu
  // Số, mảng, object... không bao giờ hợp luật
  const check =
    raw === undefined || typeof raw === 'string'
      ? validateUsername(raw)
      : ({ ok: false, code: 'USERNAME_INVALID' } as const);
  if (!check.ok) throw new BadRequestError(MESSAGES[check.code], { code: check.code });

  const owner = await deps.users.findUserIdByUsername(check.value);
  if (owner !== undefined && owner !== input.userId) {
    throw new ConflictError('Username này đã có người dùng', { code: 'USERNAME_TAKEN' });
  }
  if (owner !== input.userId) await deps.users.setUsername(input.userId, check.value);
  return { username: check.value };
}
