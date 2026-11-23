import { describe, expect, it, vi } from 'vitest';
import type { UsernameStore } from '../ports.js';
import { changeUsername } from './changeUsername.js';

const ME = 'sub-me';

/** Danh bạ giả: owners là username → sub của người đang dùng */
function storeWith(owners: Record<string, string> = {}) {
  const setUsername = vi.fn(async () => {});
  const users: UsernameStore = {
    findUserIdByUsername: async (username) => owners[username],
    setUsername,
  };
  return { users, setUsername };
}

describe('changeUsername', () => {
  it('changeUsername_savesAndReturnsUsername_whenValidAndFree', async () => {
    // Arrange
    const { users, setUsername } = storeWith({ khac: 'sub-other' });

    // Act
    const result = await changeUsername({ users }, { userId: ME, username: 'hoang.nm' });

    // Assert
    expect(result).toEqual({ username: 'hoang.nm' });
    expect(setUsername).toHaveBeenCalledWith(ME, 'hoang.nm');
  });

  it('changeUsername_rejectsWithTaken_whenAnotherUserHasUsername', async () => {
    // Arrange
    const { users, setUsername } = storeWith({ an_nguyen: 'sub-other' });

    // Act
    const result = changeUsername({ users }, { userId: ME, username: 'an_nguyen' });

    // Assert
    await expect(result).rejects.toMatchObject({ kind: 'CONFLICT', code: 'USERNAME_TAKEN' });
    expect(setUsername).not.toHaveBeenCalled();
  });

  it('changeUsername_returnsOkWithoutWriting_whenUsernameIsAlreadyMine', async () => {
    // Arrange: đổi sang đúng tên đang dùng không báo trùng
    const { users, setUsername } = storeWith({ an_nguyen: ME });

    // Act
    const result = await changeUsername({ users }, { userId: ME, username: 'an_nguyen' });

    // Assert
    expect(result).toEqual({ username: 'an_nguyen' });
    expect(setUsername).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   '])(
    'changeUsername_rejectsWithRequired_whenUsernameIs %j',
    async (username) => {
      // Act + Assert
      await expect(changeUsername(storeWith(), { userId: ME, username })).rejects.toMatchObject({
        kind: 'BAD_REQUEST',
        code: 'USERNAME_REQUIRED',
      });
    },
  );

  it.each(['An Nguyen', 'ab', 'a'.repeat(21), 'hoàng', 123, ['an_nguyen'], { a: 1 }])(
    'changeUsername_rejectsWithInvalidBeforeLookup_whenUsernameIs %j',
    async (username) => {
      // Arrange: danh bạ không được gọi khi username sai luật
      const users: UsernameStore = {
        findUserIdByUsername: async () => {
          throw new Error('không được gọi');
        },
        setUsername: async () => {
          throw new Error('không được gọi');
        },
      };

      // Act + Assert
      await expect(changeUsername({ users }, { userId: ME, username })).rejects.toMatchObject({
        kind: 'BAD_REQUEST',
        code: 'USERNAME_INVALID',
      });
    },
  );
});
