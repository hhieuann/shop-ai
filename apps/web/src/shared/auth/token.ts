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

// ── Chờ nối Cognito xong rồi mới trả lời "có đăng nhập không" ───────────────────
// main.tsx nạp Cognito (gói Amplify) song song với lúc vẽ trang. Trước khi initAuth() xong, bộ lấy token
// mặc định ở bản build luôn trả null: trang bắt buộc đăng nhập sẽ tưởng là khách và chuyển sang /login
// dù phiên còn (#499). Mặc định đã xong, để test và chạy trên mock không phải chờ.
let ready: Promise<unknown> = Promise.resolve();

/** Chờ nạp Cognito tối đa bấy nhiêu mili giây (#501) */
export const AUTH_READY_TIMEOUT_MS = 10_000;

/**
 * main.tsx đưa lời hứa nạp Cognito vào. Nạp lỗi, hoặc quá `timeoutMs` chưa xong (gói Cognito tải treo),
 * thì vẫn coi như xong: xét phiên bằng bộ lấy token đang có, không để trang quay "Đang tải…" mãi (#501).
 * Cognito nạp xong muộn thì setTokenProvider vẫn báo notifyAuthChanged() như thường.
 */
export function setAuthReady(next: Promise<unknown>, timeoutMs = AUTH_READY_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const settled = next.then(
    () => undefined,
    () => undefined,
  );
  // Nạp xong trước hạn thì huỷ hẹn giờ
  void settled.then(() => clearTimeout(timer));
  ready = Promise.race([settled, timeout]);
}

export async function getAccessToken(): Promise<string | null> {
  await ready;
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
  await ready;
  return profileProvider();
}

// ── Đăng xuất, đổi mật khẩu, làm mới hồ sơ (trang tài khoản, pages/tai-khoan.md) ──────────
// Cùng kiểu với setProfileProvider: file này giữ hàm gọi và bản chạy trên mock (token giả),
// cognito.ts đặt bản Cognito trong initAuth().

/** Lỗi có `name` giống lỗi Cognito, để trang dùng chung bảng câu lỗi (authErrors.ts) khi chạy trên mock */
function namedError(name: string, message = name): Error {
  return Object.assign(new Error(message), { name });
}

/** Chờ như gọi mạng thật để thấy trạng thái "Đang…" khi thử giao diện trên mock */
const devDelay = () => new Promise((resolve) => setTimeout(resolve, 500));

export interface SignOutOptions {
  /** Đăng xuất mọi nơi (thu hồi phiên ở mọi thiết bị), dùng khi vừa đổi mật khẩu (account.md BR-14) */
  global?: boolean;
}

type SignOutHandler = (options: Required<SignOutOptions>) => void | Promise<void>;

// Bản mock: đổi mật khẩu với mật khẩu mới chứa "loimang" thì lần đăng xuất mọi nơi kế tiếp lỗi,
// để thử giao diện "chưa đăng xuất được các thiết bị khác" (pages/tai-khoan.md 3.2)
let devFailNextGlobalSignOut = false;

function devSignOut({ global }: Required<SignOutOptions>) {
  if (global && devFailNextGlobalSignOut) {
    devFailNextGlobalSignOut = false;
    throw namedError('NetworkError', 'Mock: không gọi được đăng xuất mọi nơi');
  }
  removeDevToken();
}

let signOutHandler: SignOutHandler = devSignOut;

// Số lần đăng xuất chủ động (signOut thành công) từ lúc mở web. Trang bắt buộc đăng nhập so số này với
// lúc trang mở để biết phiên hết vì khách tự đăng xuất (về /) hay vì hết hạn, bị thu hồi (sang /login)
let signOutCount = 0;

/** Số lần đăng xuất chủ động đã xong (useRequireSignIn) */
export function getSignOutCount(): number {
  return signOutCount;
}

export function setSignOutHandler(next: SignOutHandler) {
  signOutHandler = next;
}

/**
 * Đăng xuất phiên đăng nhập. Dọn dữ liệu phiên trên trình duyệt (giỏ khách, đơn hàng trong bộ nhớ
 * đệm) do nơi gọi lo, vì phần đó thuộc tính năng giỏ và đơn hàng: xem features/account/lib/useSignOut.ts.
 *
 * `global`: lỗi thì ném ra và **giữ phiên trên máy này** để trang báo lỗi và cho thử lại.
 */
export async function signOut(options: SignOutOptions = {}): Promise<void> {
  await signOutHandler({ global: options.global ?? false });
  // Chỉ tăng khi đăng xuất xong; lỗi (vd. đăng xuất mọi nơi lỗi) thì phiên còn, số giữ nguyên
  signOutCount += 1;
  notifyAuthChanged();
}

type ChangePasswordHandler = (oldPassword: string, newPassword: string) => Promise<void>;

/**
 * Bản mock (chỉ khi `vite dev`): mật khẩu hiện tại "sai" → NotAuthorizedException, "nhieu" →
 * LimitExceededException; mật khẩu mới chứa "loimang" → đổi được nhưng đăng xuất mọi nơi sau đó lỗi.
 */
async function devChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  if (!import.meta.env.DEV) throw namedError('AuthNotConfigured', 'Chưa cấu hình Cognito');
  await devDelay();
  if (!readDevToken()) throw namedError('UserUnAuthenticatedException');
  if (oldPassword === 'sai') throw namedError('NotAuthorizedException');
  if (oldPassword === 'nhieu') throw namedError('LimitExceededException');
  if (newPassword.includes('loimang')) devFailNextGlobalSignOut = true;
}

let changePasswordHandler: ChangePasswordHandler = devChangePassword;

export function setChangePasswordHandler(next: ChangePasswordHandler) {
  changePasswordHandler = next;
}

/** Đổi mật khẩu của người đang đăng nhập (account.md BR-14). Chỉ đổi, không đăng xuất. */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await changePasswordHandler(oldPassword, newPassword);
}

/** Gợi ý cho bản mock biết hồ sơ mới; bản Cognito đọc lại từ ID token mới nên bỏ qua */
export interface ProfileHint {
  username?: string;
}

type RefreshProfileHandler = (hint?: ProfileHint) => void | Promise<void>;

function devRefreshProfile(hint?: ProfileHint) {
  // Chỉ khi chạy token giả (như readDevToken); bản build bỏ qua hint
  if (!import.meta.env.DEV || !hint?.username) return;
  try {
    localStorage.setItem('shop-ai:dev-username', hint.username);
  } catch {
    // bỏ qua
  }
}

let refreshProfileHandler: RefreshProfileHandler = devRefreshProfile;

export function setRefreshProfileHandler(next: RefreshProfileHandler) {
  refreshProfileHandler = next;
}

/**
 * Làm mới hồ sơ sau khi đổi username (pages/tai-khoan.md mục 1): lấy ID token mới rồi báo để header,
 * menu tài khoản và trang tài khoản hiện tên mới.
 */
export async function refreshProfile(hint?: ProfileHint): Promise<void> {
  await refreshProfileHandler(hint);
  notifyAuthChanged();
}
