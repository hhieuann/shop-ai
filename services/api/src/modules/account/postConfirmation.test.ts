import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import {
  makePostConfirmationHandler,
  SESSION_REVOKE_FAILED,
  type SessionRevoker,
} from './postConfirmation.js';

function event(triggerSource: string): PostConfirmationTriggerEvent {
  return {
    triggerSource,
    userPoolId: 'ap-southeast-1_TEST',
    userName: '3f0c2a9e-user',
    request: { userAttributes: { email: 'an@example.com' } },
    response: {},
  } as unknown as PostConfirmationTriggerEvent;
}

function recorder(): SessionRevoker & { calls: [string, string][] } {
  const calls: [string, string][] = [];
  return {
    calls,
    signOutEverywhere: async (userPoolId, username) => {
      calls.push([userPoolId, username]);
    },
  };
}

describe('post confirmation trigger', () => {
  it('handler_signsOutEverywhere_whenForgotPasswordConfirmed', async () => {
    // Arrange
    const sessions = recorder();
    const handler = makePostConfirmationHandler({ sessions });
    const input = event('PostConfirmation_ConfirmForgotPassword');

    // Act
    const result = await handler(input);

    // Assert: thu hồi phiên đúng user pool và đúng người dùng, trả event nguyên vẹn cho Cognito
    expect(sessions.calls).toEqual([['ap-southeast-1_TEST', '3f0c2a9e-user']]);
    expect(result).toEqual(input);
  });

  it('handler_skips_whenSignUpConfirmed', async () => {
    // Arrange: trigger cũng chạy khi xác nhận đăng ký, lúc đó chưa có phiên nào
    const sessions = recorder();
    const handler = makePostConfirmationHandler({ sessions });
    const input = event('PostConfirmation_ConfirmSignUp');

    // Act
    const result = await handler(input);

    // Assert
    expect(sessions.calls).toEqual([]);
    expect(result).toEqual(input);
  });

  it('handler_throws_whenSignOutFails', async () => {
    // Arrange: không được im lặng bỏ qua, nếu không phiên của kẻ xâm nhập vẫn còn
    const handler = makePostConfirmationHandler({
      sessions: {
        signOutEverywhere: async () => {
          throw new Error('TooManyRequestsException');
        },
      },
    });

    // Act + Assert
    await expect(handler(event('PostConfirmation_ConfirmForgotPassword'))).rejects.toThrow(
      SESSION_REVOKE_FAILED,
    );
  });

  it('handler_hidesSdkErrorDetails_fromCognitoResponse', async () => {
    // Arrange: lỗi thật trên dev 17/11, Cognito trả nguyên message này về trình duyệt
    const sdkMessage =
      'User: arn:aws:sts::111111111111:assumed-role/shop-dev-api-PostConfirmationRole/fn is not ' +
      'authorized to perform: cognito-idp:AdminUserGlobalSignOut on resource: ' +
      'arn:aws:cognito-idp:ap-southeast-1:111111111111:userpool/ap-southeast-1_TEST';
    const handler = makePostConfirmationHandler({
      sessions: {
        signOutEverywhere: async () => {
          throw Object.assign(new Error(sdkMessage), { name: 'AccessDeniedException' });
        },
      },
    });

    // Act
    const error = await handler(event('PostConfirmation_ConfirmForgotPassword')).catch(
      (e: unknown) => e as Error,
    );

    // Assert: chỉ có mã cố định, không lộ account ID, ARN, ID user pool
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(SESSION_REVOKE_FAILED);
    expect((error as Error).message).not.toMatch(/arn:|111111111111|ap-southeast-1_/);
  });
});
