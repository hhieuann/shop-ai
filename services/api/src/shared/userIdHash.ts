import { createHmac } from 'node:crypto';
import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';

/**
 * Băm userId (Cognito `sub`) trước khi lưu hoặc tra cứu dữ liệu gợi ý (events.md mục 2).
 * Dùng chung cho module `events` (ghi sự kiện) và `recommendation` (tra FOR_YOU#<userIdHash>),
 * nên hai bên luôn ra cùng một giá trị:
 *
 * - HMAC-SHA256
 * - khoá: giá trị chuỗi của tham số SSM `/shop/<env>/events/hmac-key`, dùng nguyên dạng UTF-8
 * - dữ liệu: `sub` dạng UTF-8
 * - đầu ra: hex chữ thường, 64 ký tự
 *
 * Khoá đọc qua `loadKey` một lần rồi giữ trong bộ nhớ của Lambda; đọc lỗi thì lần sau đọc lại,
 * không giữ lỗi. Khoá không bao giờ được log (threat model E6).
 */
export class HmacUserIdHasher {
  private key: Promise<string> | undefined;

  constructor(private readonly loadKey: () => Promise<string>) {}

  async hash(userId: string): Promise<string> {
    this.key ??= this.loadKey().catch((error: unknown) => {
      this.key = undefined;
      throw error;
    });
    return createHmac('sha256', await this.key)
      .update(userId)
      .digest('hex');
  }
}

/** Đọc khoá HMAC từ SSM SecureString. Truyền tên tham số, không bao giờ truyền giá trị khoá. */
export function ssmKeyLoader(ssm: SSMClient, parameterName: string): () => Promise<string> {
  return async () => {
    const { Parameter } = await ssm.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
    );
    if (!Parameter?.Value) throw new Error(`Tham số ${parameterName} không có giá trị`);
    return Parameter.Value;
  };
}
