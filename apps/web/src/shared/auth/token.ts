/**
 * Nơi duy nhất web lấy access token để gọi API.
 *
 * Phần đăng nhập Cognito do An làm. Khi xong, An chỉ cần gọi
 * `setTokenProvider(() => <lấy access token từ Cognito>)` một lần lúc khởi động app,
 * không phải sửa client.ts hay bất kỳ trang nào.
 *
 * Trong lúc chờ: khi chạy dev trên mock Prism, đặt token giả trong DevTools Console:
 *   localStorage.setItem('shop-ai:dev-token', 'dev')
 * Prism chỉ kiểm có header Authorization hay không, không kiểm token thật.
 */
type TokenProvider = () => string | null | Promise<string | null>;

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

function readDevToken(): string | null {
  // Chỉ dùng token giả khi chạy `vite dev`; bản build lên S3 không bao giờ đọc key này
  if (!import.meta.env.DEV) return null;
  try {
    return localStorage.getItem(DEV_TOKEN_KEY);
  } catch {
    return null; // trình duyệt chặn localStorage (chế độ riêng tư...)
  }
}

let provider: TokenProvider = readDevToken;

export function setTokenProvider(next: TokenProvider) {
  provider = next;
  notifyAuthChanged();
}

// ── Báo cho web biết trạng thái đăng nhập vừa đổi ─────────────────────────────
// Giỏ hàng cần biết lúc khách vừa đăng nhập hoặc đăng xuất để đổi giữa giỏ khách (trình duyệt)
// và giỏ tài khoản (server). Cognito (An làm) gọi notifyAuthChanged() sau khi đăng nhập,
// tạo tài khoản xong, đăng xuất hoặc khi token bị thu hồi.
type AuthListener = () => void;
const listeners = new Set<AuthListener>();

/** Đăng ký nghe thay đổi đăng nhập; trả về hàm huỷ đăng ký */
export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAuthChanged() {
  for (const listener of listeners) listener();
}

export async function getAccessToken(): Promise<string | null> {
  return provider();
}

/** Chỉ dùng cho trang đăng nhập tạm khi chạy `vite dev` trên mock Prism */
export function signInWithDevToken(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
  } catch {
    return false;
  }
  notifyAuthChanged();
  return true;
}

/** Đăng xuất token giả (chỉ khi dev), để thử lại luồng khách vãng lai */
export function signOutDevToken() {
  try {
    localStorage.removeItem(DEV_TOKEN_KEY);
  } catch {
    // bỏ qua
  }
  notifyAuthChanged();
}
