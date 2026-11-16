import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { AdminUserGlobalSignOutCommand } from '@aws-sdk/client-cognito-identity-provider';
import type { SessionRevoker } from '../postConfirmation.js';

/** Thu hồi mọi refresh token của người dùng bằng AdminUserGlobalSignOut. */
export class CognitoSessionRevoker implements SessionRevoker {
  constructor(private readonly cognito: CognitoIdentityProviderClient) {}

  async signOutEverywhere(userPoolId: string, username: string): Promise<void> {
    await this.cognito.send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId, Username: username }),
    );
  }
}
