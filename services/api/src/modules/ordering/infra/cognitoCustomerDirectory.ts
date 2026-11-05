import {
  ListUsersCommand,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import type { CustomerDirectory } from '../ports.js';

/** Cognito `sub` là UUID; kiểm trước khi ghép vào Filter để chuỗi lạ không chèn được vào bộ lọc */
const SUB = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Email khách đọc từ Cognito theo `sub` (An chốt 25/10): `ListUsers` lọc `sub`, `Limit` 1, chỉ lấy
 * thuộc tính `email`. Quyền `cognito-idp:ListUsers` chỉ trên user pool của môi trường (infra).
 * Email không lưu bảng, không ghi log (threat model).
 */
export class CognitoCustomerDirectory implements CustomerDirectory {
  constructor(
    private readonly cognito: CognitoIdentityProviderClient,
    private readonly userPoolId: string,
  ) {}

  async emailOf(userId: string): Promise<string | null> {
    if (!SUB.test(userId)) return null;
    const { Users } = await this.cognito.send(
      new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: `sub = "${userId}"`,
        Limit: 1,
        AttributesToGet: ['email'],
      }),
    );
    const email = Users?.[0]?.Attributes?.find((attr) => attr.Name === 'email')?.Value;
    return email ?? null;
  }
}
