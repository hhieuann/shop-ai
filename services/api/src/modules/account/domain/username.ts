/**
 * Username hiện trên header (docs/web/pages/dang-nhap.md §3.2): 3–20 ký tự,
 * chữ thường không dấu, số, dấu chấm, gạch dưới. Đăng nhập vẫn bằng email.
 */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

export type UsernameErrorCode = 'USERNAME_REQUIRED' | 'USERNAME_INVALID';

export type UsernameCheck =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly code: UsernameErrorCode };

/** Không tự sửa (vd. hạ chữ hoa): web gửi đúng giá trị khách thấy, sai thì báo để khách tự sửa. */
export function validateUsername(raw: string | undefined): UsernameCheck {
  if (raw === undefined || raw.trim() === '') return { ok: false, code: 'USERNAME_REQUIRED' };
  if (!USERNAME_PATTERN.test(raw)) return { ok: false, code: 'USERNAME_INVALID' };
  return { ok: true, value: raw };
}
