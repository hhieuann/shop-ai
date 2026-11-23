import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import {
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { UserDirectory, UsernameStore } from '../ports.js';

/** Danh bạ người dùng trên Cognito; username nằm ở thuộc tính preferred_username. */
export class CognitoUserDirectory implements UserDirectory, UsernameStore {
  constructor(
    private readonly cognito: CognitoIdentityProviderClient,
    private readonly userPoolId: string,
  ) {}

  async isUsernameTaken(username: string): Promise<boolean> {
    return (await this.findUserIdByUsername(username)) !== undefined;
  }

  async findUserIdByUsername(username: string): Promise<string | undefined> {
    // username đã qua validateUsername nên không chứa dấu nháy kép, an toàn khi ghép vào Filter
    const { Users } = await this.cognito.send(
      new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: `preferred_username = "${username}"`,
        AttributesToGet: ['sub'],
        Limit: 1,
      }),
    );
    const user = Users?.[0];
    if (!user) return undefined;
    // Không có sub (không xảy ra với Cognito) thì vẫn coi là đã có người dùng
    return user.Attributes?.find((a) => a.Name === 'sub')?.Value ?? user.Username ?? '';
  }

  async setUsername(userId: string, username: string): Promise<void> {
    // User pool đăng nhập bằng email: Admin API nhận sub làm Username
    await this.cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
        UserAttributes: [{ Name: 'preferred_username', Value: username }],
      }),
    );
  }
}
