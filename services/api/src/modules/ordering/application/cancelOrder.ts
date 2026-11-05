import { CannotCancelError, OrderNotFoundError } from '../domain/errors.js';
import { isOrderId } from '../domain/history.js';
import { canCancel, type Order } from '../domain/order.js';
import type { OrderCancellation, OrderStore } from '../ports.js';
import { notifyWorker, type NotifyWorkerDeps } from './notifyWorker.js';

export interface CancelOrderDeps extends NotifyWorkerDeps {
  readonly orders: Pick<OrderStore, 'get'> & OrderCancellation;
  /** ISO 8601 UTC; test truyền giờ cố định */
  readonly now: () => string;
}

export interface CancelOrderInput {
  readonly userId: string;
  readonly orderId: string;
  readonly correlationId: string;
}

/** Trạng thái đổi giữa lúc đọc và ghi (worker vừa xác nhận đơn): đọc lại, tối đa từng này lần */
export const MAX_CANCEL_ATTEMPTS = 3;

/**
 * DELETE /api/v1/orders/{orderId}: khách huỷ đơn của mình (ordering.md BR-10, BR-12, BR-13).
 * 1. đọc đơn theo userId của token; không có, của người khác hoặc orderId sai dạng → 404;
 * 2. trạng thái không huỷ được (SHIPPED, DELIVERED, CANCELLED) → 409, không ghi gì;
 * 3. một giao dịch: CANCELLED, hoàn kho, giảm `#OPEN`; trạng thái vừa đổi thì đọc lại và xét lại;
 * 4. gửi tin CANCELLED cho worker gửi email; gửi lỗi thì vẫn trả đơn đã huỷ.
 * Huỷ lần hai thấy CANCELLED ở bước 2 nên trả 409 và không hoàn kho thêm.
 */
export async function cancelOrder(deps: CancelOrderDeps, input: CancelOrderInput): Promise<Order> {
  if (!isOrderId(input.orderId)) throw new OrderNotFoundError(input.orderId);

  for (let attempt = 1; ; attempt++) {
    const order = await deps.orders.get(input.userId, input.orderId);
    if (!order) throw new OrderNotFoundError(input.orderId);
    if (!canCancel(order.status, 'customer')) throw new CannotCancelError(order.orderId);

    const now = deps.now();
    const result = await deps.orders.cancel({ order, now });
    if (result === 'cancelled') {
      await notifyWorker(deps, {
        orderId: order.orderId,
        userId: order.userId,
        type: 'CANCELLED',
        correlationId: input.correlationId,
      });
      // Giao dịch chỉ đổi hai trường này, không cần đọc lại bảng
      return { ...order, status: 'CANCELLED', updatedAt: now };
    }
    if (attempt >= MAX_CANCEL_ATTEMPTS) throw new CannotCancelError(order.orderId);
  }
}
