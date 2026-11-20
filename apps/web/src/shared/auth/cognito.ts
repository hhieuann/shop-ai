/**
 * Nối Cognito vào web (ADR-0007, dang-nhap.md §8). Gọi initAuth() một lần lúc khởi động app.
 *
 * - Cấu hình đọc lúc chạy từ /config.json (stack web ghi khi deploy), nên một bản build dùng cho mọi môi trường.
 * - Token lưu cookie Secure + SameSite=Strict thay vì localStorage mặc định của Amplify.
 * - Không có /config.json (chạy `vite dev` trên mock Prism) thì giữ token giả của token.ts như cũ.
 */
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signOut as amplifySignOut, updatePassword } from 'aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { CookieStorage, Hub } from 'aws-amplify/utils';
import {
  notifyAuthChanged,
  setChangePasswordHandler,
  setProfileProvider,
  setRefreshProfileHandler,
  setSignOutHandler,
  setTokenProvider,
  type SignOutOptions,
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

/**
 * Thu hồi phiên ở mọi thiết bị: gọi thẳng Cognito GlobalSignOut (account.md BR-14).
 * Không dùng `signOut({ global: true })` của Amplify: bản 6.21.2 bắt mọi lỗi của bước này rồi vẫn xoá
 * token, nên khách không biết phiên ở máy khác chưa bị thu hồi. Ở đây lỗi thì ném ra (`name` theo
 * `__type` của Cognito, mất mạng là NetworkError) để trang báo và cho thử lại.
 * CSP `connect-src` của stack web đã cho phép endpoint này (infra/lib/web-stack.ts).
 */
export async function globalSignOut(
  region: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.GlobalSignOut',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify({ AccessToken: accessToken }),
    });
  } catch {
    throw Object.assign(new Error('Không gọi được Cognito GlobalSignOut'), {
      name: 'NetworkError',
    });
  }
  if (res.ok) return;
  let type = '';
  try {
    const body = (await res.json()) as { __type?: unknown };
    // __type có thể kèm tiền tố, vd. "com.amazonaws...#NotAuthorizedException"
    type = typeof body.__type === 'string' ? (body.__type.split('#').pop() ?? '') : '';
  } catch {
    // body không phải JSON
  }
  throw Object.assign(new Error(`GlobalSignOut lỗi ${res.status}`), {
    name: type || 'GlobalSignOutError',
  });
}

interface SignOutDeps {
  getAccessToken: () => Promise<string | null>;
  revokeEverywhere: (accessToken: string) => Promise<void>;
  clearThisDevice: () => Promise<void>;
}

/**
 * Bản Cognito của signOut (token.ts). Đăng xuất mọi nơi: thu hồi được phiên ở mọi thiết bị rồi mới xoá
 * phiên máy này; thu hồi lỗi thì ném ra và giữ phiên để thử lại. Không có token (phiên đã hết) thì
 * không còn gì để thu hồi, chỉ xoá máy này.
 */
export function cognitoSignOutHandler(deps: SignOutDeps) {
  return async ({ global }: Required<SignOutOptions>) => {
    if (global) {
      const token = await deps.getAccessToken();
      if (token) await deps.revokeEverywhere(token);
    }
    await deps.clearThisDevice();
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
  const region = config.region || config.userPoolId.split('_')[0] || '';
  setSignOutHandler(
    cognitoSignOutHandler({
      getAccessToken: async () => (await fetchAuthSession()).tokens?.accessToken.toString() ?? null,
      revokeEverywhere: (accessToken) => globalSignOut(region, accessToken),
      // Không truyền global: phiên đã thu hồi ở bước trên (hoặc chỉ đăng xuất máy này)
      clearThisDevice: () => amplifySignOut(),
    }),
  );
  setChangePasswordHandler((oldPassword, newPassword) =>
    updatePassword({ oldPassword, newPassword }),
  );
  // ID token mới mang preferred_username mới; hint chỉ dành cho bản mock
  setRefreshProfileHandler(async () => {
    await fetchAuthSession({ forceRefresh: true });
  });

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
