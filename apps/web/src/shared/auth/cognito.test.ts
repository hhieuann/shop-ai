import { describe, expect, it } from 'vitest';
import { profileFromIdToken } from './cognito';

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
