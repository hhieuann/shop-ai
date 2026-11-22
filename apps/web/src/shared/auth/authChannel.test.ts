// @vitest-environment jsdom
/**
 * #508: kênh báo đăng nhập, đăng xuất giữa các tab. File riêng vì kênh được tạo một lần trong module
 * token.ts: mỗi ca nạp lại module (vi.resetModules) với BroadcastChannel giả.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** BroadcastChannel giả: ghi lại tin gửi đi, cho test bắn tin tới */
class FakeChannel {
  static instances: FakeChannel[] = [];
  readonly posted: unknown[] = [];
  private listeners = new Set<(event: MessageEvent) => void>();
  constructor(readonly name: string) {
    FakeChannel.instances.push(this);
  }
  postMessage(data: unknown) {
    this.posted.push(data);
  }
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  /** Tin từ tab khác tới */
  deliver(data: unknown) {
    for (const listener of this.listeners) listener({ data } as MessageEvent);
  }
}

async function loadToken() {
  vi.resetModules();
  return import('./token');
}

beforeEach(() => {
  FakeChannel.instances = [];
  localStorage.clear();
  localStorage.setItem('shop-ai:dev-token', 'dev');
  vi.stubGlobal('BroadcastChannel', FakeChannel);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('kênh báo giữa các tab (#508)', () => {
  it('announceAuthChanged_postsOnlyType_withoutTokenEmailOrSub', async () => {
    // Arrange
    const token = await loadToken();

    // Act
    token.announceAuthChanged();

    // Assert: một kênh tên shop-ai-auth, tin chỉ có loại tin
    expect(FakeChannel.instances).toHaveLength(1);
    expect(FakeChannel.instances[0]!.name).toBe('shop-ai-auth');
    expect(FakeChannel.instances[0]!.posted).toEqual([{ type: 'auth-changed' }]);
  });

  it('onOtherTabAuthChange_callsListener_onlyForAuthMessage_andUnsubscribes', async () => {
    // Arrange
    const token = await loadToken();
    const listener = vi.fn();
    const off = token.onOtherTabAuthChange(listener);
    const channel = FakeChannel.instances[0]!;

    // Act + Assert: tin khác loại thì bỏ qua
    channel.deliver({ type: 'something-else' });
    channel.deliver(null);
    expect(listener).not.toHaveBeenCalled();

    channel.deliver({ type: 'auth-changed' });
    expect(listener).toHaveBeenCalledTimes(1);

    // Act + Assert: huỷ thì không nhận nữa
    off();
    channel.deliver({ type: 'auth-changed' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('startupTokenRefreshAndProfileRefresh_doNotPost', async () => {
    // Arrange
    const token = await loadToken();
    token.announceAuthChanged(); // tạo kênh để đếm
    const channel = FakeChannel.instances[0]!;
    channel.posted.length = 0;

    // Act: nạp Cognito lúc mở tab, làm mới token, báo trong tab, đổi username
    token.setTokenProvider(() => 'token-moi');
    token.setProfileProvider(() => null);
    token.notifyAuthChanged();
    await token.refreshProfile({ username: 'ten_moi' });

    // Assert: chỉ đăng nhập, đăng xuất do khách bấm mới gửi tin
    expect(channel.posted).toEqual([]);
  });

  it('withoutBroadcastChannel_doesNotThrow', async () => {
    // Arrange: trình duyệt không có BroadcastChannel
    vi.stubGlobal('BroadcastChannel', undefined);
    const token = await loadToken();

    // Act + Assert
    expect(() => token.announceAuthChanged()).not.toThrow();
    const off = token.onOtherTabAuthChange(() => undefined);
    expect(() => off()).not.toThrow();
  });

  it('getCurrentUserId_readsSubFromProfile_andNullForGuest', async () => {
    // Arrange: bản mock đọc sub giả trong localStorage
    const token = await loadToken();
    localStorage.setItem('shop-ai:dev-user-id', 'sub-b');

    // Act + Assert
    expect(await token.getCurrentUserId()).toBe('sub-b');
    localStorage.removeItem('shop-ai:dev-token');
    expect(await token.getCurrentUserId()).toBeNull();
  });
});
