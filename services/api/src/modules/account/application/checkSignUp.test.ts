import { describe, expect, it } from 'vitest';
import type { UserDirectory } from '../ports.js';
import { checkSignUp, SignUpRejectedError } from './checkSignUp.js';

function directoryWith(...taken: string[]): UserDirectory {
  return { isUsernameTaken: async (username) => taken.includes(username) };
}

describe('checkSignUp', () => {
  it('checkSignUp_passes_whenUsernameValidAndFree', async () => {
    // Act + Assert
    await expect(
      checkSignUp({ users: directoryWith('khac') }, { username: 'an_nguyen' }),
    ).resolves.toBeUndefined();
  });

  it('checkSignUp_rejectsWithTaken_whenSomeoneHasUsername', async () => {
    // Act
    const result = checkSignUp({ users: directoryWith('an_nguyen') }, { username: 'an_nguyen' });

    // Assert
    await expect(result).rejects.toBeInstanceOf(SignUpRejectedError);
    await expect(result).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
  });

  it('checkSignUp_rejectsBeforeLookup_whenUsernameInvalid', async () => {
    // Arrange: thư mục người dùng không được gọi khi username sai luật
    const users: UserDirectory = {
      isUsernameTaken: async () => {
        throw new Error('không được gọi');
      },
    };

    // Act + Assert
    await expect(checkSignUp({ users }, { username: 'An Nguyen' })).rejects.toMatchObject({
      code: 'USERNAME_INVALID',
    });
  });
});
