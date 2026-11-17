/** Ô nhận lỗi; 'alert' là thông báo đầu form (dang-nhap.md §4) */
export type AuthErrorTarget =
  | 'alert'
  | 'username'
  | 'email'
  | 'password'
  | 'code'
  /** Ô "Mật khẩu hiện tại" ở trang đổi mật khẩu */
  | 'currentPassword'
  /** Phiên đăng nhập đã hết: sang /login */
  | 'session'
  /** Quên mật khẩu: mật khẩu đã đổi dù Cognito báo lỗi (trigger L9), xử lý như thành công */
  | 'resetDone';

export interface AuthErrorView {
  readonly target: AuthErrorTarget;
  readonly message: string;
}

/** Mã do Lambda Pre sign-up trả (services/api/src/modules/account), Cognito bọc thành UserLambdaValidationException */
const SIGN_UP_REJECTIONS: Record<string, AuthErrorView> = {
  USERNAME_TAKEN: { target: 'username', message: 'Username này đã có người dùng.' },
  USERNAME_INVALID: {
    target: 'username',
    message: 'Username chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới.',
  },
  USERNAME_REQUIRED: { target: 'username', message: 'Vui lòng nhập username' },
};

const BY_NAME: Record<string, AuthErrorView> = {
  NotAuthorizedException: { target: 'alert', message: 'Email hoặc mật khẩu không đúng.' },
  UsernameExistsException: { target: 'email', message: 'Email này đã có tài khoản.' },
  InvalidPasswordException: {
    target: 'password',
    message: 'Mật khẩu chưa đạt điều kiện bên dưới.',
  },
  CodeMismatchException: { target: 'code', message: 'Mã không đúng. Kiểm tra lại email mới nhất.' },
  ExpiredCodeException: { target: 'code', message: 'Mã đã hết hạn. Bấm Gửi lại mã.' },
  NetworkError: { target: 'alert', message: 'Không kết nối được máy chủ, vui lòng thử lại.' },
};

const TOO_MANY = new Set([
  'LimitExceededException',
  'TooManyRequestsException',
  'TooManyFailedAttemptsException',
]);

/** Đổi lỗi Cognito (qua Amplify) thành câu chữ và vị trí hiển thị theo dang-nhap.md §4 */
export function toAuthError(error: unknown): AuthErrorView {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  const message =
    typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

  if (name === 'UserLambdaValidationException') {
    const code = Object.keys(SIGN_UP_REJECTIONS).find((c) => message.includes(c));
    if (code) return SIGN_UP_REJECTIONS[code]!;
  }
  if (TOO_MANY.has(name)) {
    return {
      target: 'alert',
      message: 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
    };
  }
  return BY_NAME[name] ?? { target: 'alert', message: 'Có lỗi xảy ra, vui lòng thử lại.' };
}

/**
 * Lỗi ở trang quên mật khẩu (dang-nhap.md §3.4). Như toAuthError, trừ NotAuthorizedException: ở đây
 * không có mật khẩu nào để sai (vd. tài khoản bị khoá), nên câu "Email hoặc mật khẩu không đúng." sai ngữ cảnh.
 */
export function toResetPasswordError(error: unknown): AuthErrorView {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  const message =
    typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  // Trigger Post confirmation (L9, thu hồi phiên máy khác) chạy SAU khi Cognito đã đổi mật khẩu. Trigger
  // lỗi (UserLambdaValidationException: Lambda ném SESSION_REVOKE_FAILED; UnexpectedLambdaException:
  // Lambda bị throttle) thì Cognito vẫn báo lỗi, message bắt đầu bằng "PostConfirmation", nhưng mật
  // khẩu mới đã dùng được: coi như đặt lại xong (An, Nhân chốt 17/11). Lỗi Pre sign-up không có tiền tố này.
  if (
    (name === 'UserLambdaValidationException' || name === 'UnexpectedLambdaException') &&
    message.startsWith('PostConfirmation')
  ) {
    return {
      target: 'resetDone',
      message:
        'Đã đặt mật khẩu mới, nhưng chưa đăng xuất được các thiết bị khác. Đăng nhập bằng mật khẩu mới; nếu nghi bị lộ, hãy đổi mật khẩu lần nữa sau khi đăng nhập.',
    };
  }
  if (name === 'NotAuthorizedException') {
    return {
      target: 'alert',
      message: 'Không đặt lại được mật khẩu cho tài khoản này. Vui lòng liên hệ shop.',
    };
  }
  return toAuthError(error);
}

/**
 * Lỗi ở trang đổi mật khẩu khi đã đăng nhập (pages/tai-khoan.md mục 4). Như toAuthError, trừ:
 * - NotAuthorizedException là sai mật khẩu hiện tại ("Email hoặc mật khẩu không đúng." sai ngữ cảnh vì
 *   khách đã đăng nhập), trừ khi Cognito báo access token bị thu hồi hoặc hết hạn: khi đó là phiên hết;
 * - phiên hết (Amplify không làm mới được token) thì sang /login.
 */
export function toChangePasswordError(error: unknown): AuthErrorView {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  const message =
    typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  if (name === 'UserUnAuthenticatedException') return { target: 'session', message: '' };
  if (name === 'NotAuthorizedException') {
    if (/access token/i.test(message)) return { target: 'session', message: '' };
    return { target: 'currentPassword', message: 'Mật khẩu hiện tại không đúng.' };
  }
  return toAuthError(error);
}
