/** Ô nhận lỗi; 'alert' là thông báo đầu form (dang-nhap.md §4) */
export type AuthErrorTarget = 'alert' | 'username' | 'email' | 'password' | 'code';

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
