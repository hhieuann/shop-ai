import { createHmac } from 'node:crypto';
import type { UserIdHasher } from '../ports.js';

/**
 * HMAC-SHA256 của userId, dạng hex. Khoá đọc qua `loadKey` một lần rồi giữ trong bộ nhớ của
 * Lambda; đọc lỗi thì lần sau đọc lại, không giữ lỗi. Khoá không bao giờ được log (threat model E6).
 */
export class HmacUserIdHasher implements UserIdHasher {
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
