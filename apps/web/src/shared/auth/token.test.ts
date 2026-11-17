// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  getAccessToken,
  getUserProfile,
  onAuthChange,
  refreshProfile,
  signOut,
} from './token';

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Bản mock khi chạy `vite dev` trên Prism (pages/tai-khoan.md: thử giao diện thành công và lỗi) */
describe('token.ts bản mock', () => {
  it('changePassword_resolves_whenCurrentPasswordAccepted', async () => {
    // Act + Assert
    await expect(changePassword('Cu12345!', 'Moi12345!')).resolves.toBeUndefined();
  });

  it('changePassword_throwsNotAuthorized_whenCurrentPasswordIsSai', async () => {
    await expect(changePassword('sai', 'Moi12345!')).rejects.toMatchObject({
      name: 'NotAuthorizedException',
    });
  });

  it('changePassword_throwsLimitExceeded_whenCurrentPasswordIsNhieu', async () => {
    await expect(changePassword('nhieu', 'Moi12345!')).rejects.toMatchObject({
      name: 'LimitExceededException',
    });
  });

  it('changePassword_throws_whenSignedOut', async () => {
    // Arrange
    localStorage.removeItem(DEV_TOKEN_KEY);

    // Act + Assert
    await expect(changePassword('Cu12345!', 'Moi12345!')).rejects.toMatchObject({
      name: 'UserUnAuthenticatedException',
    });
  });

  it('signOutGlobal_failsOnceAndKeepsSession_afterNewPasswordWithLoimang', async () => {
    // Arrange: đổi mật khẩu với mật khẩu mới chứa "loimang"
    await changePassword('Cu12345!', 'Moi-loimang-1A!');
    const listener = vi.fn();
    const unsubscribe = onAuthChange(listener);

    // Act + Assert: lần đầu lỗi, phiên máy này giữ nguyên, không báo đăng xuất
    await expect(signOut({ global: true })).rejects.toMatchObject({ name: 'NetworkError' });
    expect(await getAccessToken()).toBe('dev');
    expect(listener).not.toHaveBeenCalled();

    // Act + Assert: thử lại thì đăng xuất được
    await signOut({ global: true });
    expect(await getAccessToken()).toBeNull();

    // Verify
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('signOut_removesDevToken_andNotifies', async () => {
    // Arrange
    const listener = vi.fn();
    const unsubscribe = onAuthChange(listener);

    // Act
    await signOut();

    // Assert
    expect(await getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('refreshProfile_writesHintUsername_andNotifies_inDev', async () => {
    // Arrange
    const listener = vi.fn();
    const unsubscribe = onAuthChange(listener);

    // Act
    await refreshProfile({ username: 'hoang.nm' });

    // Assert
    expect((await getUserProfile())?.username).toBe('hoang.nm');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('refreshProfile_ignoresHint_whenNotDev', async () => {
    // Arrange: bản build (An chốt 17/11: hint chỉ dùng khi chạy token giả)
    vi.stubEnv('DEV', false);
    const listener = vi.fn();
    const unsubscribe = onAuthChange(listener);

    // Act
    await refreshProfile({ username: 'hoang.nm' });

    // Assert
    expect(localStorage.getItem('shop-ai:dev-username')).toBeNull();

    // Verify: vẫn báo để web đọc lại hồ sơ
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('changePassword_throws_whenNotDevAndNoCognito', async () => {
    // Arrange
    vi.stubEnv('DEV', false);

    // Act + Assert: bản build không giả thành công
    await expect(changePassword('Cu12345!', 'Moi12345!')).rejects.toMatchObject({
      name: 'AuthNotConfigured',
    });
  });
});
