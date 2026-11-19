import { describe, expect, it } from 'vitest';
import {
  toAuthError,
  toChangePasswordError,
  toResetPasswordError,
  toTwoFactorError,
} from './authErrors';

const err = (name: string, message = '') => Object.assign(new Error(message), { name });

describe('toAuthError', () => {
  it.each([
    {
      name: 'toAuthError_hidesWhichFieldIsWrong_whenNotAuthorized',
      error: err('NotAuthorizedException'),
      target: 'alert',
      message: 'Email hoặc mật khẩu không đúng.',
    },
    {
      name: 'toAuthError_pointsToEmail_whenEmailAlreadyRegistered',
      error: err('UsernameExistsException'),
      target: 'email',
      message: 'Email này đã có tài khoản.',
    },
    {
      name: 'toAuthError_pointsToPassword_whenPolicyNotMet',
      error: err('InvalidPasswordException'),
      target: 'password',
      message: 'Mật khẩu chưa đạt điều kiện bên dưới.',
    },
    {
      name: 'toAuthError_pointsToCode_whenCodeWrong',
      error: err('CodeMismatchException'),
      target: 'code',
      message: 'Mã không đúng. Kiểm tra lại email mới nhất.',
    },
    {
      name: 'toAuthError_pointsToCode_whenCodeExpired',
      error: err('ExpiredCodeException'),
      target: 'code',
      message: 'Mã đã hết hạn. Bấm Gửi lại mã.',
    },
    {
      name: 'toAuthError_asksToWait_whenThrottled',
      error: err('LimitExceededException'),
      target: 'alert',
      message: 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
    },
    {
      name: 'toAuthError_reportsNetwork_whenOffline',
      error: err('NetworkError'),
      target: 'alert',
      message: 'Không kết nối được máy chủ, vui lòng thử lại.',
    },
    {
      name: 'toAuthError_pointsToUsername_whenPreSignUpRejectsTaken',
      error: err('UserLambdaValidationException', 'PreSignUp failed with error USERNAME_TAKEN.'),
      target: 'username',
      message: 'Username này đã có người dùng.',
    },
    {
      name: 'toAuthError_pointsToUsername_whenPreSignUpRejectsInvalid',
      error: err('UserLambdaValidationException', 'PreSignUp failed with error USERNAME_INVALID.'),
      target: 'username',
      message: 'Username chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới.',
    },
    {
      name: 'toAuthError_fallsBackToGenericAlert_whenUnknown',
      error: 'lạ',
      target: 'alert',
      message: 'Có lỗi xảy ra, vui lòng thử lại.',
    },
  ])('$name', ({ error, target, message }) => {
    // Act + Assert
    expect(toAuthError(error)).toEqual({ target, message });
  });
});

describe('toResetPasswordError', () => {
  it('toResetPasswordError_doesNotBlameEmailOrPassword_whenNotAuthorized', () => {
    // Act + Assert: trang quên mật khẩu không có mật khẩu nào để sai
    expect(toResetPasswordError(err('NotAuthorizedException'))).toEqual({
      target: 'alert',
      message: 'Không đặt lại được mật khẩu cho tài khoản này. Vui lòng liên hệ shop.',
    });
  });

  it('toResetPasswordError_matchesToAuthError_forOtherErrors', () => {
    // Act + Assert
    for (const name of [
      'CodeMismatchException',
      'ExpiredCodeException',
      'LimitExceededException',
    ]) {
      expect(toResetPasswordError(err(name))).toEqual(toAuthError(err(name)));
    }
  });
});

describe('toResetPasswordError khi trigger L9 lỗi', () => {
  const RESET_DONE =
    'Đã đặt mật khẩu mới, nhưng chưa đăng xuất được các thiết bị khác. Đăng nhập bằng mật khẩu mới; nếu nghi bị lộ, hãy đổi mật khẩu lần nữa sau khi đăng nhập.';

  it('toResetPasswordError_isResetDone_whenPostConfirmationRejected', () => {
    // Lambda ném SESSION_REVOKE_FAILED
    expect(
      toResetPasswordError(
        err(
          'UserLambdaValidationException',
          'PostConfirmation failed with error SESSION_REVOKE_FAILED.',
        ),
      ),
    ).toEqual({ target: 'resetDone', message: RESET_DONE });
  });

  it('toResetPasswordError_isResetDone_whenPostConfirmationThrottled', () => {
    // Lambda bị throttle
    expect(
      toResetPasswordError(
        err(
          'UnexpectedLambdaException',
          'PostConfirmation invocation failed due to error TooManyRequestsException.',
        ),
      ),
    ).toEqual({ target: 'resetDone', message: RESET_DONE });
  });

  it('toResetPasswordError_keepsOldMessages_whenNotPostConfirmation', () => {
    // Pre sign-up vẫn như cũ; lỗi cùng tên mà không phải PostConfirmation vẫn là câu chung
    expect(
      toResetPasswordError(
        err('UserLambdaValidationException', 'PreSignUp failed with error USERNAME_TAKEN.'),
      ),
    ).toEqual(
      toAuthError(
        err('UserLambdaValidationException', 'PreSignUp failed with error USERNAME_TAKEN.'),
      ),
    );
    expect(toResetPasswordError(err('UserLambdaValidationException', 'Lỗi khác')).message).toBe(
      'Có lỗi xảy ra, vui lòng thử lại.',
    );
    expect(toResetPasswordError(err('UnexpectedLambdaException', 'Lỗi khác')).message).toBe(
      'Có lỗi xảy ra, vui lòng thử lại.',
    );
  });
});

describe('toChangePasswordError', () => {
  const named = (name: string, message = name) => Object.assign(new Error(message), { name });

  it('toChangePasswordError_blamesCurrentPassword_whenNotAuthorized', () => {
    expect(
      toChangePasswordError(named('NotAuthorizedException', 'Incorrect username or password.')),
    ).toEqual({
      target: 'currentPassword',
      message: 'Mật khẩu hiện tại không đúng.',
    });
  });

  it('toChangePasswordError_meansSessionEnded_whenAccessTokenRevokedOrSignedOut', () => {
    expect(
      toChangePasswordError(named('NotAuthorizedException', 'Access Token has been revoked'))
        .target,
    ).toBe('session');
    expect(toChangePasswordError(named('UserUnAuthenticatedException')).target).toBe('session');
  });

  it('toChangePasswordError_matchesToAuthError_forOtherErrors', () => {
    for (const name of [
      'InvalidPasswordException',
      'LimitExceededException',
      'NetworkError',
      'Khac',
    ]) {
      expect(toChangePasswordError(named(name))).toEqual(toAuthError(named(name)));
    }
  });
});

describe('toTwoFactorError', () => {
  const named = (name: string, message = name) => Object.assign(new Error(message), { name });

  it('toTwoFactorError_codeTarget_whenCodeWrong', () => {
    // Act
    const mismatch = toTwoFactorError(named('CodeMismatchException'));
    const enable = toTwoFactorError(named('EnableSoftwareTokenMFAException'));

    // Assert: cả hai mã lỗi Cognito của mã sai đều báo dưới ô mã
    const expected = {
      target: 'code',
      message: 'Mã không đúng. Nhập mã đang hiện trong ứng dụng (mã đổi mỗi 30 giây).',
    };
    expect(mismatch).toEqual(expected);
    expect(enable).toEqual(expected);
  });

  it('toTwoFactorError_session_whenSignedOutOrTokenRevoked', () => {
    expect(toTwoFactorError(named('UserUnAuthenticatedException')).target).toBe('session');
    expect(
      toTwoFactorError(named('NotAuthorizedException', 'Access Token has been revoked')).target,
    ).toBe('session');
  });

  it('toTwoFactorError_tooManyMessage_whenRateLimited', () => {
    expect(toTwoFactorError(named('LimitExceededException'))).toEqual({
      target: 'alert',
      message: 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
    });
  });

  it('toTwoFactorError_networkMessage_whenNetworkOrUnknown', () => {
    const expected = {
      target: 'alert',
      message: 'Không kết nối được máy chủ, vui lòng thử lại.',
    };
    expect(toTwoFactorError(named('NetworkError'))).toEqual(expected);
    expect(toTwoFactorError(new TypeError('Failed to fetch'))).toEqual(expected);
  });
});
