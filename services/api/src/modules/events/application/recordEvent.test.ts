import { describe, expect, it, vi } from 'vitest';
import type { StoredEvent } from '../domain/event.js';
import { recordEvent, type RecordEventDeps } from './recordEvent.js';

const NOW = '2026-10-22T03:00:00.000Z';

function deps(overrides: Partial<RecordEventDeps> = {}) {
  const put = vi.fn<(event: StoredEvent) => Promise<void>>().mockResolvedValue(undefined);
  return {
    put,
    deps: {
      events: { put },
      hasher: { hash: vi.fn().mockResolvedValue('hash-of-user') },
      now: () => NOW,
      newId: () => 'event-1',
      ...overrides,
    } satisfies RecordEventDeps,
  };
}

describe('recordEvent', () => {
  it('recordEvent_storesHashInsteadOfUserId_withServerTimeAnd90DayTtl', async () => {
    // Arrange
    const { put, deps: d } = deps();

    // Act
    await recordEvent(d, { userId: 'user-sub-1', productId: 'P1', eventType: 'VIEW' });

    // Assert
    expect(d.hasher.hash).toHaveBeenCalledWith('user-sub-1');
    expect(put).toHaveBeenCalledWith({
      userIdHash: 'hash-of-user',
      eventId: 'event-1',
      productId: 'P1',
      eventType: 'VIEW',
      timestamp: NOW,
      ttl: Date.parse(NOW) / 1000 + 90 * 24 * 60 * 60,
    });
    expect(JSON.stringify(put.mock.calls)).not.toContain('user-sub-1');
  });

  it('recordEvent_doesNotWrite_whenHasherFails', async () => {
    // Arrange: không đọc được khoá HMAC thì không được ghi userId thật thay thế
    const { put, deps: d } = deps({
      hasher: { hash: vi.fn().mockRejectedValue(new Error('SSM lỗi')) },
    });

    // Act + Assert
    await expect(
      recordEvent(d, { userId: 'user-sub-1', productId: 'P1', eventType: 'ADD_TO_CART' }),
    ).rejects.toThrow('SSM lỗi');
    expect(put).not.toHaveBeenCalled();
  });
});
