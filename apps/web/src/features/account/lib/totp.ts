/** Tên shop hiện trong ứng dụng xác thực (nhãn và issuer của URI otpauth, pages/tai-khoan.md 3.4) */
export const TOTP_ISSUER = 'Black Magic';

/**
 * URI `otpauth://totp/` để tạo mã QR và link "Mở bằng ứng dụng trên máy này". Tự dựng thay cho
 * `getSetupUri` của Amplify vì bản đó ghép nhãn, issuer không mã hoá URL (email có "+" hay "&" làm
 * hỏng URI). Nhãn là "issuer:email", dấu ":" giữ nguyên theo định dạng Key URI.
 */
export function totpUri(secret: string, email: string, issuer = TOTP_ISSUER): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  const params = `secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}`;
  return `otpauth://totp/${label}?${params}`;
}

/** Mã chữ chia nhóm 4 ký tự cho dễ đọc, dễ gõ ("ABCD EFGH …") */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}
