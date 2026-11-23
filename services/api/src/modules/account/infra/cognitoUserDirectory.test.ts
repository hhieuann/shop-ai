import {
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { describe, expect, it, vi } from 'vitest';
import { CognitoUserDirectory } from './cognitoUserDirectory.js';

const POOL = 'ap-southeast-1_test';

function directory(send = vi.fn()) {
  return {
    send,
    directory: new CognitoUserDirectory({ send } as unknown as CognitoIdentityProviderClient, POOL),
  };
}

describe('CognitoUserDirectory', () => {
  it('findUserIdByUsername_returnsSubOfOwner_andReadsOnlySub', async () => {
    // Arrange
    const { send, directory: d } = directory(
      vi.fn().mockResolvedValue({
        Users: [{ Username: 'sub-1', Attributes: [{ Name: 'sub', Value: 'sub-1' }] }],
      }),
    );

    // Act
    const owner = await d.findUserIdByUsername('an_nguyen');

    // Assert
    expect(owner).toBe('sub-1');

    // Verify: lọc theo preferred_username, 1 người, chỉ thuộc tính sub
    const command = send.mock.calls[0]?.[0] as ListUsersCommand;
    expect(command).toBeInstanceOf(ListUsersCommand);
    expect(command.input).toEqual({
      UserPoolId: POOL,
      Filter: 'preferred_username = "an_nguyen"',
      AttributesToGet: ['sub'],
      Limit: 1,
    });
  });

  it('findUserIdByUsername_returnsUndefined_whenNobodyHasUsername', async () => {
    // Arrange
    const { directory: d } = directory(vi.fn().mockResolvedValue({ Users: [] }));

    // Act + Assert
    await expect(d.findUserIdByUsername('moi_tinh')).resolves.toBeUndefined();
    await expect(d.isUsernameTaken('moi_tinh')).resolves.toBe(false);
  });

  it('isUsernameTaken_returnsTrue_whenSomeoneHasUsername', async () => {
    // Arrange
    const { directory: d } = directory(
      vi.fn().mockResolvedValue({ Users: [{ Attributes: [{ Name: 'sub', Value: 'sub-1' }] }] }),
    );

    // Act + Assert
    await expect(d.isUsernameTaken('an_nguyen')).resolves.toBe(true);
  });

  it('setUsername_updatesOnlyPreferredUsername_ofUserBySub', async () => {
    // Arrange
    const { send, directory: d } = directory(vi.fn().mockResolvedValue({}));

    // Act
    await d.setUsername('sub-1', 'hoang.nm');

    // Verify
    const command = send.mock.calls[0]?.[0] as AdminUpdateUserAttributesCommand;
    expect(command).toBeInstanceOf(AdminUpdateUserAttributesCommand);
    expect(command.input).toEqual({
      UserPoolId: POOL,
      Username: 'sub-1',
      UserAttributes: [{ Name: 'preferred_username', Value: 'hoang.nm' }],
    });
  });
});
