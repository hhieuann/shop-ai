import { describe, expect, it, vi } from 'vitest';
import { cognitoSignOutHandler, globalSignOut, profileFromIdToken } from './cognito';

describe('profileFromIdToken', () => {
  it('profileFromIdToken_readsUsernameEmailAndAdmin_fromIdTokenClaims', () => {
    // Act
    const profile = profileFromIdToken({
      preferred_username: 'an_nguyen',
      email: 'an@example.com',
      'cognito:groups': ['admin'],
    });

    // Assert
    expect(profile).toEqual({ username: 'an_nguyen', email: 'an@example.com', isAdmin: true });
  });

  it('profileFromIdToken_fallsBackToEmail_whenNoUsername', () => {
    // Arrange: user admin tạo bằng CLI (vd. cho E2E) không có preferred_username
    const profile = profileFromIdToken({ email: 'e2e@example.com' });

    // Assert
    expect(profile).toEqual({
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
