import { SendEmailCommand, type SESv2Client } from '@aws-sdk/client-sesv2';
import type { EmailContent } from '../domain/notification.js';
import type { EmailRejectedReason, Mailer, SendEmailResult } from '../ports.js';

/** Tên hiển thị của địa chỉ gửi */
const SENDER_NAME = 'Black Magic';

/**
 * Lỗi SES mà gửi lại cũng vô ích (An chốt 25/10): không vào DLQ, chỉ log warn + metric.
 * Throttling chỉ tới đây khi client đã thử lại hết lượt (`retryMode: 'adaptive'`, xem sesClientConfig).
 */
const REJECTED: Readonly<Record<string, EmailRejectedReason>> = {
  // Sandbox: địa chỉ nhận chưa xác minh (vd. người dùng E2E e2e-user@example.com)
  MessageRejected: 'not_verified',
  MailFromDomainNotVerifiedException: 'not_verified',
  AccountSuspendedException: 'sending_disabled',
  SendingPausedException: 'sending_disabled',
  TooManyRequestsException: 'throttled',
  ThrottlingException: 'throttled',
  LimitExceededException: 'throttled',
};

/** Client SES chậm lại khi bị throttle (sandbox 1 thư/giây), tối đa 4 lần trong timeout 10 giây của worker */
export const sesClientConfig = { retryMode: 'adaptive', maxAttempts: 4 } as const;

export class SesMailer implements Mailer {
  constructor(
    private readonly ses: SESv2Client,
    private readonly senderEmail: string,
  ) {}

  async send(to: string, content: EmailContent): Promise<SendEmailResult> {
    try {
      await this.ses.send(
        new SendEmailCommand({
          FromEmailAddress: `${SENDER_NAME} <${this.senderEmail}>`,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: content.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: content.text, Charset: 'UTF-8' },
                Html: { Data: content.html, Charset: 'UTF-8' },
              },
            },
          },
        }),
      );
      return { status: 'sent' };
    } catch (error) {
      const reason = error instanceof Error ? REJECTED[error.name] : undefined;
      if (reason) return { status: 'rejected', reason };
      // Lỗi tạm (mạng, 5xx): ném để SQS giao lại tin
      throw error;
    }
  }
}
