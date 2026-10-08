/** Chính sách mật khẩu của user pool (infra/lib/api-stack.ts), hiện thành danh sách điều kiện (dang-nhap.md §3.2) */
export const PASSWORD_RULES = [
  { id: 'length', label: 'Ít nhất 8 ký tự', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'Có chữ hoa', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Có chữ thường', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit', label: 'Có số', test: (p: string) => /[0-9]/.test(p) },
  // Cognito coi mọi ký tự không phải chữ, số, khoảng trắng là ký tự đặc biệt
  { id: 'symbol', label: 'Có ký tự đặc biệt', test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
] as const;

export function passwordMeetsPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/** Cùng luật với Lambda Pre sign-up (services/api/src/modules/account/domain/username.ts) */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

/** Kiểm dạng email ở trình duyệt; Cognito vẫn kiểm lại */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
