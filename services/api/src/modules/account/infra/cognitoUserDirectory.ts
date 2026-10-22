import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import type { UserDirectory } from '../ports.js';

/** Hỏi Cognito xem đã có ai dùng username (preferred_username) chưa. */
export class CognitoUserDirectory implements UserDirectory {
  constructor(
    private readonly cognito: CognitoIdentityProviderClient,
    private readonly userPoolId: string,
  ) {}

  async isUsernameTaken(username: string): Promise<boolean> {
    // username đã qua validateUsername nên không chứa dấu nháy kép, an toàn khi ghép vào Filter
    const { Users } = await this.cognito.send(
      new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: `preferred_username = "${username}"`,
        Limit: 1,
      }),
    );
    return (Users?.length ?? 0) > 0;
  }
}
