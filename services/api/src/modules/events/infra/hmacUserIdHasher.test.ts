import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { HmacUserIdHasher } from './hmacUserIdHasher.js';

// Khoá sinh trong test, không phải khoá thật; viết cứng chuỗi trông như khoá dễ làm gitleaks báo nhầm
const KEY = ['test', 'only', 'key'].join('-');

describe('HmacUserIdHasher', () => {
  it('hash_returnsHmacSha256Hex_andSameValueForSameUser', async () => {
    // Arrange
    const hasher = new HmacUserIdHasher(() => Promise.resolve(KEY));

    // Act
    const first = await hasher.hash('user-sub-1');
    const second = await hasher.hash('user-sub-1');

    // Assert
    expect(first).toBe(createHmac('sha256', KEY).update('user-sub-1').digest('hex'));
    expect(second).toBe(first);
    expect(first).not.toContain('user-sub-1');
  });

  it('hash_differsForOtherUserOrOtherKey', async () => {
    // Arrange
    const hasher = new HmacUserIdHasher(() => Promise.resolve(KEY));
    const otherKey = new HmacUserIdHasher(() => Promise.resolve(`${KEY}-2`));

    // Act + Assert
    expect(await hasher.hash('user-sub-1')).not.toBe(await hasher.hash('user-sub-2'));
    expect(await hasher.hash('user-sub-1')).not.toBe(await otherKey.hash('user-sub-1'));
  });

  it('hash_loadsKeyOnce_butRetriesAfterLoadFailure', async () => {
    // Arrange
    const loadKey = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('SSM lỗi'))
      .mockResolvedValue(KEY);
    const hasher = new HmacUserIdHasher(loadKey);

    // Act
    await expect(hasher.hash('u1')).rejects.toThrow('SSM lỗi');
    await hasher.hash('u1');
    await hasher.hash('u2');

    // Assert: lỗi không bị giữ lại; đọc được rồi thì không gọi SSM nữa
    expect(loadKey).toHaveBeenCalledTimes(2);
  });
});
