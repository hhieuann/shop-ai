import { describe, expect, it, vi } from 'vitest';
import {
  cognitoSignOutHandler,
  cognitoTwoFactorHandlers,
  globalSignOut,
  profileFromIdToken,
} from './cognito';

describe('profileFromIdToken', () => {
  it('profileFromIdToken_readsSubUsernameEmailAndAdmin_fromIdTokenClaims', () => {
    // Act
    const profile = profileFromIdToken({
      sub: 'sub-an',
      preferred_username: 'an_nguyen',
      email: 'an@example.com',
      'cognito:groups': ['admin'],
    });

    // Assert
    // userId là sub: định danh không đổi để biết tab còn là cùng một người (#508)
    expect(profile).toEqual({
      userId: 'sub-an',
      username: 'an_nguyen',
      email: 'an@example.com',
      isAdmin: true,
    });
  });

  it('profileFromIdToken_fallsBackToEmail_whenNoUsername', () => {
    // Arrange: user admin tạo bằng CLI (vd. cho E2E) không có preferred_username
    const profile = profileFromIdToken({ sub: 'sub-e2e', email: 'e2e@example.com' });

    // Assert
    expect(profile).toEqual({
      userId: 'sub-e2e',
      username: 'e2e@example.com',
      email: 'e2e@example.com',
      isAdmin: false,
    });
  });

  it('profileFromIdToken_returnsNull_whenSignedOut', () => {
    expect(profileFromIdToken(undefined)).toBeNull();
  });
});

describe('globalSignOut', () => {
  const ok = () => new Response('{}', { status: 200 });

  it('globalSignOut_postsAccessToken_toCognitoEndpoint', async () => {
    // Arrange
    const fetchImpl = vi.fn(async () => ok());

    // Act
    await globalSignOut('ap-southeast-1', 'access-token-thu', fetchImpl);

    // Assert
    expect(fetchImpl).toHaveBeenCalledWith('https://cognito-idp.ap-southeast-1.amazonaws.com/', {
      method: 'POST',
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.GlobalSignOut',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify({ AccessToken: 'access-token-thu' }),
    });
  });

  it('globalSignOut_throwsCognitoErrorName_whenRejected', async () => {
    // Arrange
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ __type: 'NotAuthorizedException', message: 'revoked' }), {
          status: 400,
        }),
    );

    // Act + Assert
    await expect(globalSignOut('ap-southeast-1', 't', fetchImpl)).rejects.toMatchObject({
      name: 'NotAuthorizedException',
    });
  });

  it('globalSignOut_throwsNetworkError_whenFetchFails', async () => {
    // Arrange
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    // Act + Assert
    await expect(globalSignOut('ap-southeast-1', 't', fetchImpl)).rejects.toMatchObject({
      name: 'NetworkError',
    });
  });
});

describe('cognitoSignOutHandler', () => {
  const deps = () => ({
    getAccessToken: vi.fn(async (): Promise<string | null> => 'access-token-thu'),
    revokeEverywhere: vi.fn(async () => {}),
    clearThisDevice: vi.fn(async () => {}),
  });

  it('global_revokesThenClearsThisDevice', async () => {
    // Arrange
    const d = deps();

    // Act
    await cognitoSignOutHandler(d)({ global: true });

    // Assert
    expect(d.revokeEverywhere).toHaveBeenCalledWith('access-token-thu');
    expect(d.clearThisDevice).toHaveBeenCalledTimes(1);
  });

  it('global_throwsAndKeepsThisDevice_whenRevokeFails', async () => {
    // Arrange
    const d = deps();
    d.revokeEverywhere.mockRejectedValue(Object.assign(new Error('x'), { name: 'NetworkError' }));

    // Act + Assert
    await expect(cognitoSignOutHandler(d)({ global: true })).rejects.toMatchObject({
      name: 'NetworkError',
    });

    // Verify: phiên máy này giữ nguyên để thử lại
    expect(d.clearThisDevice).not.toHaveBeenCalled();
  });

  it('local_onlyClearsThisDevice', async () => {
    // Arrange
    const d = deps();

    // Act
    await cognitoSignOutHandler(d)({ global: false });

    // Assert
    expect(d.revokeEverywhere).not.toHaveBeenCalled();
    expect(d.clearThisDevice).toHaveBeenCalledTimes(1);
  });
});

describe('cognitoTwoFactorHandlers', () => {
  // Sinh lúc chạy, không viết cứng chuỗi trông như khoá (gitleaks)
  const generated = crypto.randomUUID();

  /** Thay nạp động cognitoMfa.ts bằng hàm giả */
  const load = (api: ReturnType<typeof deps>) => () => Promise.resolve(api as never);

  function deps(enabled?: ('TOTP' | 'SMS' | 'EMAIL')[]) {
    return {
      fetchMFAPreference: vi.fn(async () => ({ enabled })),
      setUpTOTP: vi.fn(async () => ({
        sharedSecret: generated,
        getSetupUri: () => new URL('otpauth://totp/x'),
      })),
      verifyTOTPSetup: vi.fn(async () => undefined),
      updateMFAPreference: vi.fn(async () => undefined),
    };
  }

  it('isEnabled_readsTotpFromMfaPreference', async () => {
    expect(await cognitoTwoFactorHandlers(load(deps(['TOTP']))).isEnabled()).toBe(true);
    expect(await cognitoTwoFactorHandlers(load(deps([]))).isEnabled()).toBe(false);
    // Chưa bật cách nào: Cognito không trả `enabled`
    expect(await cognitoTwoFactorHandlers(load(deps())).isEnabled()).toBe(false);
  });

  it('setUp_returnsOnlySharedSecret', async () => {
    // Act
    const secret = await cognitoTwoFactorHandlers(load(deps())).setUp();

    // Assert: URI do trang tự dựng (lib/totp.ts), không dùng getSetupUri
    expect(secret).toBe(generated);
  });

  it('verify_passesCode_toVerifyTotpSetup', async () => {
    // Arrange
    const d = deps();

    // Act
    await cognitoTwoFactorHandlers(load(d)).verify('123456');

    // Verify
    expect(d.verifyTOTPSetup).toHaveBeenCalledWith({ code: '123456' });
  });

  it('setEnabled_setsTotpPreferredOrDisabled', async () => {
    // Arrange
    const d = deps();
    const handlers = cognitoTwoFactorHandlers(load(d));

    // Act
    await handlers.setEnabled(true);
    await handlers.setEnabled(false);

    // Verify
    expect(d.updateMFAPreference).toHaveBeenNthCalledWith(1, { totp: 'PREFERRED' });
    expect(d.updateMFAPreference).toHaveBeenNthCalledWith(2, { totp: 'DISABLED' });
  });
});
