import { randomUUID } from 'node:crypto';
import {
  ListUsersCommand,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { describe, expect, it, vi } from 'vitest';
import { CognitoCustomerDirectory } from './cognitoCustomerDirectory.js';

function directory(send = vi.fn()) {
  return {
    send,
    directory: new CognitoCustomerDirectory(
      { send } as unknown as CognitoIdentityProviderClient,
      'ap-southeast-1_test',
    ),
  };
}

describe('CognitoCustomerDirectory', () => {
  it('emailOf_listsOneUserBySub_andReadsOnlyEmail', async () => {
    // Arrange
    const sub = randomUUID();
    const { send, directory: d } = directory(
      vi.fn().mockResolvedValue({
        Users: [{ Attributes: [{ Name: 'email', Value: 'khach@example.com' }] }],
      }),
    );

    // Act
    const email = await d.emailOf(sub);

    // Assert
    expect(email).toBe('khach@example.com');

    // Verify: An chốt 25/10, Limit 1, chỉ thuộc tính email
    const command = send.mock.calls[0]?.[0] as ListUsersCommand;
    expect(command).toBeInstanceOf(ListUsersCommand);
    expect(command.input).toEqual({
      UserPoolId: 'ap-southeast-1_test',
      Filter: `sub = "${sub}"`,
      Limit: 1,
      AttributesToGet: ['email'],
    });
  });

  it('emailOf_returnsNull_whenNoUser', async () => {
    // Arrange
    const { directory: d } = directory(vi.fn().mockResolvedValue({ Users: [] }));

    // Act
    const email = await d.emailOf(randomUUID());

    // Assert
    expect(email).toBeNull();
  });

  it.each(['user-1', 'x" or sub ^= "', ''])(
    'emailOf_returnsNull_withoutCallingCognito_whenUserIdNotUuid %s',
    async (userId) => {
      // Arrange
      const { send, directory: d } = directory();

      // Act
      const email = await d.emailOf(userId);

      // Assert: chuỗi lạ không được ghép vào Filter
      expect(email).toBeNull();

      // Verify
      expect(send).not.toHaveBeenCalled();
    },
  );
});
