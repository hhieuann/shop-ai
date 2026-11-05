import { logger } from '../../../shared/logger.js';
import { orderEmail, type EmailKind } from '../domain/notification.js';
import type { Order } from '../domain/order.js';
import type { CustomerDirectory, EmailMetrics, Mailer, SendEmailResult } from '../ports.js';

export interface SendOrderEmailDeps {
  readonly customers: CustomerDirectory;
  readonly mailer: Mailer;
  readonly metrics: EmailMetrics;
}

/**
 * Gửi thư xác nhận hoặc báo huỷ cho chủ đơn (ordering.md 2.2, BR-13).
 * - Email lấy từ Cognito theo `userId`; không có thì coi như bị từ chối (`no_recipient`).
 * - SES từ chối vĩnh viễn (chưa xác minh trong sandbox, vd. người dùng E2E) hoặc throttle hết lượt:
 *   log warn + metric, không ném, nên tin không vào DLQ (An chốt 25/10). Lỗi tạm thì ném để SQS giao lại.
 * Log không có địa chỉ email (threat model O8). Chống gửi trùng do lambda bọc Powertools Idempotency.
 */
export async function sendOrderEmail(
  deps: SendOrderEmailDeps,
  order: Order,
  kind: EmailKind,
): Promise<SendEmailResult> {
  const to = await deps.customers.emailOf(order.userId);
  const result: SendEmailResult = to
    ? await deps.mailer.send(to, orderEmail(order, kind))
    : { status: 'rejected', reason: 'no_recipient' };

  if (result.status === 'rejected') {
    logger.warn('Không gửi được thư cho khách, bỏ qua', {
      orderId: order.orderId,
      kind,
      reason: result.reason,
    });
    deps.metrics.emailRejected(result.reason);
  }
  return result;
}
