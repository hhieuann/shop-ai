/**
 * Nối Cognito vào web (ADR-0007, dang-nhap.md §8). Gọi initAuth() một lần lúc khởi động app.
 *
 * - Cấu hình đọc lúc chạy từ /config.json (stack web ghi khi deploy), nên một bản build dùng cho mọi môi trường.
 * - Token lưu cookie Secure + SameSite=Strict thay vì localStorage mặc định của Amplify.
 * - Không có /config.json (chạy `vite dev` trên mock Prism) thì giữ token giả của token.ts như cũ.
 */
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { CookieStorage, Hub } from 'aws-amplify/utils';
import {
  notifyAuthChanged,
  setProfileProvider,
  setSignOutHandler,
  setTokenProvider,
  type UserProfile,
} from './token';

export interface WebConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
}

async function loadConfig(): Promise<WebConfig | null> {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const config = (await res.json()) as Partial<WebConfig>;
    return config.userPoolId && config.userPoolClientId ? (config as WebConfig) : null;
  } catch {
    return null;
  }
}

/** Đổi ID token thành hồ sơ cho nút tài khoản (username = preferred_username khi đăng ký) */
export function profileFromIdToken(
  payload: Record<string, unknown> | undefined,
): UserProfile | null {
  if (!payload) return null;
  const groups = payload['cognito:groups'];
  return {
    username: String(payload.preferred_username ?? payload.email ?? ''),
    email: String(payload.email ?? ''),
    isAdmin: Array.isArray(groups) && groups.includes('admin'),
  };
}

let mode: 'cognito' | 'dev' | undefined;

/** 'cognito' khi đã cấu hình được Cognito; 'dev' khi chạy trên mock (giữ token giả) */
export async function initAuth(): Promise<'cognito' | 'dev'> {
  if (mode) return mode;
  const config = await loadConfig();
  if (!config) return (mode = 'dev');

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: { email: true },
        signUpVerificationMethod: 'code',
      },
    },
  });
  cognitoUserPoolsTokenProvider.setKeyValueStorage(
    new CookieStorage({
      path: '/',
      // localhost (http) không đặt được cookie Secure
      secure: window.location.protocol === 'https:',
      sameSite: 'strict',
      expires: 30, // ngày, bằng hạn refresh token của app client
    }),
  );

  // Amplify tự làm mới access token khi gần hết hạn; không làm mới được thì coi như chưa đăng nhập
  setTokenProvider(async () => {
    try {
      return (await fetchAuthSession()).tokens?.accessToken.toString() ?? null;
    } catch {
      return null;
    }
  });
  setProfileProvider(async () => {
    try {
      return profileFromIdToken((await fetchAuthSession()).tokens?.idToken?.payload);
    } catch {
      return null;
    }
  });
  setSignOutHandler(() => amplifySignOut());

  // Token bị thu hồi hoặc hết hạn không làm mới được: báo để giỏ hàng và header cập nhật
  Hub.listen('auth', ({ payload }) => {
    if (payload.event === 'tokenRefresh_failure' || payload.event === 'signedOut') {
      notifyAuthChanged();
    }
  });
  return (mode = 'cognito');
}

/** Trang đăng nhập dùng để biết có Cognito hay đang chạy trên mock */
export function authMode() {
  return mode;
}
