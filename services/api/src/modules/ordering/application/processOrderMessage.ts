import { z } from 'zod';
import { orderConfirmedEvent } from '../domain/notification.js';
import type { Order } from '../domain/order.js';
import type { OrderConfirmation, OrderEvents, OrderStore } from '../ports.js';

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
}

/** Kết quả để handler ghi log; không có dữ liệu cá nhân */
export type ProcessOrderOutcome =
  | 'confirmed'
  | 'republished'
  | 'skippedCancelled'
  | 'skippedNotFound'
  | 'skippedPastConfirmed'
  | 'cancelNoted';

/** Trạng thái đổi giữa lúc đọc và ghi (khách vừa huỷ): đọc lại, tối đa từng này lần */
export const MAX_CONFIRM_ATTEMPTS = 3;

/**
 * Worker order-processor (ordering.md, luồng SQS):
 * - PLACED: đơn `CANCELLED` thì bỏ qua; `PENDING` thì xác nhận có điều kiện; đơn `CONFIRMED` (vừa xác
 *   nhận hoặc từ lần giao trước) thì gửi tin `order-confirmed`. Gửi lại mỗi lần chạy, không bọc
 *   Idempotency: consumer events chống trùng theo `<orderId>#<productId>` (#252).
 * - CANCELLED: email báo huỷ làm ở PR email (BR-13); tạm thời chỉ báo lại cho handler ghi log.
 * Lỗi (DynamoDB, SNS) thì ném để SQS giao lại tin.
 */
export async function processOrderMessage(
  deps: ProcessOrderMessageDeps,
  message: OrderMessageInput,
): Promise<ProcessOrderOutcome> {
  if (message.type === 'CANCELLED') return 'cancelNoted';

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
        return 'republished';
      case 'PENDING': {
        const now = deps.now();
        const result = await deps.orders.confirm({ order, now });
        if (result === 'confirmed') {
          const confirmed: Order = { ...order, status: 'CONFIRMED', updatedAt: now };
          await deps.events.publishConfirmed(orderConfirmedEvent(confirmed));
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
