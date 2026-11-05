import { z } from 'zod';
import { orderConfirmedEvent, type EmailKind } from '../domain/notification.js';
import type { Order } from '../domain/order.js';
import type { OrderConfirmation, OrderEvents, OrderStore, SendEmailResult } from '../ports.js';

/**
 * Tin trong hàng đợi đơn do API gửi (application/notifyWorker.ts). Worker chỉ dùng `orderId`, `userId`
 * làm khoá rồi đọc lại đơn từ bảng, không tin gì khác trong tin (threat model O9).
 */
export const orderMessageSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  type: z.enum(['PLACED', 'CANCELLED']),
  correlationId: z.string(),
});
export type OrderMessageInput = z.infer<typeof orderMessageSchema>;

export interface ProcessOrderMessageDeps {
  readonly orders: Pick<OrderStore, 'get'> & OrderConfirmation;
  readonly events: OrderEvents;
  /** ISO 8601 UTC; test truyền giờ cố định */
  readonly now: () => string;
  /**
   * Gửi thư cho chủ đơn (ordering.md 2.2, BR-13), đã bọc chống gửi trùng theo `orderId` + loại thư.
   * Không có khi Lambda thiếu cấu hình thư (`emailConfig`): worker vẫn xác nhận đơn, gửi tin.
   */
  readonly sendEmail?: (order: Order, kind: EmailKind) => Promise<SendEmailResult>;
}

/** Kết quả để handler ghi log; không có dữ liệu cá nhân */
export type ProcessOrderOutcome =
  | 'confirmed'
  | 'republished'
  | 'skippedCancelled'
  | 'skippedNotFound'
  | 'skippedPastConfirmed'
  | 'cancelEmailSent'
  | 'cancelEmailRejected'
  | 'skippedNotCancelled'
  | 'cancelNoted';

/** Trạng thái đổi giữa lúc đọc và ghi (khách vừa huỷ): đọc lại, tối đa từng này lần */
export const MAX_CONFIRM_ATTEMPTS = 3;

/**
 * Worker order-processor (ordering.md, luồng SQS):
 * - PLACED: đơn `CANCELLED` thì bỏ qua; `PENDING` thì xác nhận có điều kiện; đơn `CONFIRMED` (vừa xác
 *   nhận hoặc từ lần giao trước) thì gửi tin `order-confirmed`. Gửi lại mỗi lần chạy, không bọc
 *   Idempotency: consumer events chống trùng theo `<orderId>#<productId>` (#252).
 *   Sau tin `order-confirmed` thì gửi thư xác nhận (Q3: thư lỗi không chặn PURCHASE).
 * - CANCELLED (BR-13): đọc lại đơn, chỉ gửi thư báo huỷ khi đơn đang `CANCELLED`.
 * Không có `sendEmail` thì bỏ bước thư. Lỗi (DynamoDB, SNS, lỗi tạm của SES) thì ném để SQS giao lại tin.
 */
export async function processOrderMessage(
  deps: ProcessOrderMessageDeps,
  message: OrderMessageInput,
): Promise<ProcessOrderOutcome> {
  if (message.type === 'CANCELLED') return cancelled(deps, message);

  for (let attempt = 1; ; attempt++) {
    const order = await deps.orders.get(message.userId, message.orderId);
    if (!order) return 'skippedNotFound';

    switch (order.status) {
      case 'CANCELLED':
        // Khách huỷ trước khi tin tới worker: không xác nhận, không gửi gì (ordering.md mục 5)
        return 'skippedCancelled';
      case 'SHIPPED':
      case 'DELIVERED':
        // Đã qua bước xác nhận từ lâu; tin tới muộn (gửi lại tay từ DLQ) thì không làm gì
        return 'skippedPastConfirmed';
      case 'CONFIRMED':
        await deps.events.publishConfirmed(orderConfirmedEvent(order));
        await deps.sendEmail?.(order, 'CONFIRMED');
        return 'republished';
      case 'PENDING': {
        const now = deps.now();
        const result = await deps.orders.confirm({ order, now });
        if (result === 'confirmed') {
          const confirmed: Order = { ...order, status: 'CONFIRMED', updatedAt: now };
          await deps.events.publishConfirmed(orderConfirmedEvent(confirmed));
          await deps.sendEmail?.(confirmed, 'CONFIRMED');
          return 'confirmed';
        }
        // Trạng thái vừa đổi: đọc lại rồi xét lại; đổi liên tục thì ném để SQS giao lại sau
        if (attempt >= MAX_CONFIRM_ATTEMPTS) {
          throw new Error(`Đơn ${order.orderId} đổi trạng thái liên tục khi xác nhận`);
        }
      }
    }
  }
}

/** Tin CANCELLED: thư báo huỷ chỉ khi đơn đang `CANCELLED` (tin giả, tin cũ thì bỏ qua) */
async function cancelled(
  deps: ProcessOrderMessageDeps,
  message: OrderMessageInput,
): Promise<ProcessOrderOutcome> {
  if (!deps.sendEmail) return 'cancelNoted';
  const order = await deps.orders.get(message.userId, message.orderId);
  if (!order) return 'skippedNotFound';
  if (order.status !== 'CANCELLED') return 'skippedNotCancelled';
  const result = await deps.sendEmail(order, 'CANCELLED');
  return result.status === 'sent' ? 'cancelEmailSent' : 'cancelEmailRejected';
}
