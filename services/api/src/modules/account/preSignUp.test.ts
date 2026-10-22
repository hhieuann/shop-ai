import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { makePreSignUpHandler } from './preSignUp.js';

function signUpEvent(attributes: Record<string, string>): PreSignUpTriggerEvent {
  return {
    triggerSource: 'PreSignUp_SignUp',
    request: { userAttributes: attributes },
    response: { autoConfirmUser: false, autoVerifyEmail: false, autoVerifyPhone: false },
  } as unknown as PreSignUpTriggerEvent;
}

describe('pre sign-up trigger', () => {
  it('handler_returnsEventUnchanged_whenUsernameAccepted', async () => {
    // Arrange
    const handler = makePreSignUpHandler({ users: { isUsernameTaken: async () => false } });
    const event = signUpEvent({ email: 'an@example.com', preferred_username: 'an_nguyen' });

    // Act
    const result = await handler(event);

    // Assert: không tự xác nhận tài khoản, khách vẫn phải nhập mã gửi email
    expect(result).toEqual(event);
    expect(result.response.autoConfirmUser).toBe(false);
  });

  it('handler_throwsErrorCode_whenUsernameTaken', async () => {
    // Arrange: Cognito trả lỗi "PreSignUp failed with error USERNAME_TAKEN." cho web
    const handler = makePreSignUpHandler({ users: { isUsernameTaken: async () => true } });

    // Act + Assert
    await expect(handler(signUpEvent({ preferred_username: 'an_nguyen' }))).rejects.toThrow(
      'USERNAME_TAKEN',
    );
  });

  it('handler_skipsCheck_whenAdminCreatesUser', async () => {
    // Arrange: admin tạo user từ console/CLI (vd. user cho E2E) không cần username
    const handler = makePreSignUpHandler({
      users: {
        isUsernameTaken: async () => {
          throw new Error('không được gọi');
        },
      },
    });
    const event = {
      ...signUpEvent({}),
      triggerSource: 'PreSignUp_AdminCreateUser',
    } as PreSignUpTriggerEvent;

    // Act + Assert
    await expect(handler(event)).resolves.toEqual(event);
  });
});
