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
  removeDevToken();
  notifyAuthChanged();
}

function removeDevToken() {
  try {
    localStorage.removeItem(DEV_TOKEN_KEY);
  } catch {
    // bỏ qua
  }
}

// ── Thông tin tài khoản cho nút tài khoản trên header (design-system §9.17) ───
// An gọi setProfileProvider(() => <đọc username, email, nhóm admin từ ID token Cognito>)
// và setSignOutHandler(() => <đăng xuất Cognito>) lúc khởi động app.

export interface UserProfile {
  /** Tên điền lúc tạo tài khoản, hiện trên header (dang-nhap.md §3.2) */
  username: string;
  email: string;
  /** Thuộc nhóm `admin` của user pool: hiện mục "Trang quản trị" */
  isAdmin: boolean;
}

type ProfileProvider = () => UserProfile | null | Promise<UserProfile | null>;

// Khi chạy dev với token giả: đổi tên, email, quyền admin trong DevTools Console để thử giao diện:
//   localStorage.setItem('shop-ai:dev-username', 'mot_ten_rat_dai_de_thu')
//   localStorage.setItem('shop-ai:dev-admin', '1')
function readDevProfile(): UserProfile | null {
  if (!readDevToken()) return null;
  const get = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const username = get('shop-ai:dev-username') || 'khachthu';
  return {
    username,
    email: `${username}@example.com`,
    isAdmin: get('shop-ai:dev-admin') === '1',
  };
}

let profileProvider: ProfileProvider = readDevProfile;

export function setProfileProvider(next: ProfileProvider) {
  profileProvider = next;
  notifyAuthChanged();
}

/** Hồ sơ người đang đăng nhập; null khi chưa đăng nhập */
export async function getUserProfile(): Promise<UserProfile | null> {
  return profileProvider();
}

type SignOutHandler = () => void | Promise<void>;
let signOutHandler: SignOutHandler = removeDevToken;

export function setSignOutHandler(next: SignOutHandler) {
  signOutHandler = next;
}

/**
 * Đăng xuất phiên đăng nhập. Dọn dữ liệu phiên trên trình duyệt (giỏ khách, đơn hàng trong bộ nhớ
 * đệm) do nơi gọi lo, vì phần đó thuộc tính năng giỏ và đơn hàng: xem AccountMenu.tsx.
 */
export async function signOut(): Promise<void> {
  await signOutHandler();
  notifyAuthChanged();
}
