import { describe, expect, it } from 'vitest';
import { toAuthError } from './authErrors';

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
