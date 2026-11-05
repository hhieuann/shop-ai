import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { HmacUserIdHasher, ssmKeyLoader } from './userIdHash.js';
import type { SSMClient } from '@aws-sdk/client-ssm';

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

  it('hash_matchesDocumentedFormat_hexLowercase64Chars', async () => {
    // Arrange: module recommendation băm lại sub để tra FOR_YOU#<userIdHash>, phải ra cùng định dạng
    const hasher = new HmacUserIdHasher(() => Promise.resolve(KEY));

    // Act
    const value = await hasher.hash('user-sub-1');

    // Assert
    expect(value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ssmKeyLoader_readsSecureStringWithDecryption_andFailsWhenEmpty', async () => {
    // Arrange
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Parameter: { Value: KEY } })
      .mockResolvedValueOnce({ Parameter: {} });
    const ssm = { send } as unknown as SSMClient;
    const load = ssmKeyLoader(ssm, '/shop/dev/events/hmac-key');

    // Act + Assert
    await expect(load()).resolves.toBe(KEY);
    expect(send.mock.calls[0]?.[0].input).toEqual({
      Name: '/shop/dev/events/hmac-key',
      WithDecryption: true,
    });
    await expect(load()).rejects.toThrow('/shop/dev/events/hmac-key');
  });
});
