import { logger } from '../../../shared/logger.js';
import { AdminCannotCancelError, AdminOrderNotFoundError } from '../domain/errors.js';
import { isOrderId } from '../domain/history.js';
import {
  canCancel,
  ORDER_STATUSES,
  toSummary,
  type AdminOrderSummary,
  type Order,
} from '../domain/order.js';
import type { AdminOrders, OrderCancellation, OrderStore } from '../ports.js';
import { MAX_CANCEL_ATTEMPTS } from './cancelOrder.js';
import { notifyWorker, type NotifyWorkerDeps } from './notifyWorker.js';

export interface AdminCancelOrderDeps extends NotifyWorkerDeps {
  /** Tra `userId` theo `orderId` qua index `byStatus` (route chỉ có `orderId`) */
  readonly admin: Pick<AdminOrders, 'findInStatus'>;
  /** Đọc mạnh trên bảng chính và giao dịch huỷ dùng chung với khách huỷ (BR-12) */
  readonly orders: Pick<OrderStore, 'get'> & OrderCancellation;
  /** ISO 8601 UTC; test truyền giờ cố định */
  readonly now: () => string;
}

export interface AdminCancelOrderInput {
  /** `sub` của admin trong token, chỉ để ghi log */
  readonly adminId: string;
  readonly orderId: string;
  readonly correlationId: string;
}

/**
 * DELETE /api/v1/admin/orders/{orderId}: admin huỷ đơn (ordering.md "Admin huỷ đơn", BR-11, BR-12, BR-13).
 * 1. bảng orders khoá userId + orderId nên tìm đơn qua index `byStatus` ở mọi trạng thái; không thấy
 *    (hoặc orderId sai dạng) → 404, index có thể trễ nên câu báo gợi ý thử lại;
 * 2. đọc lại đơn trên bảng chính (đọc mạnh) và quyết theo bản này, không theo index;
 * 3. `DELIVERED`, `CANCELLED` → 409 CANNOT_CANCEL kèm trạng thái hiện tại, không ghi gì;
 * 4. giao dịch huỷ như khách: CANCELLED, hoàn kho, giảm `#OPEN` chỉ khi đơn đang mở (đơn SHIPPED
 *    đã giảm lúc sang SHIPPED); trạng thái vừa đổi thì đọc lại, tối đa MAX_CANCEL_ATTEMPTS lần;
 * 5. gửi tin CANCELLED cho worker gửi thư; gửi lỗi vẫn trả thành công (log, metric).
 * Huỷ lần hai thấy CANCELLED ở bước 3 nên trả 409 và không hoàn kho thêm. Không trả địa chỉ (O8).
 */
export async function adminCancelOrder(
  deps: AdminCancelOrderDeps,
  input: AdminCancelOrderInput,
): Promise<AdminOrderSummary> {
  const { orderId } = input;
  if (!isOrderId(orderId)) throw new AdminOrderNotFoundError(orderId);

  const found = await Promise.all(
    ORDER_STATUSES.map((status) => deps.admin.findInStatus(status, orderId)),
  );
  const record = found.find((r) => r !== null);
  if (!record) throw new AdminOrderNotFoundError(orderId);

  for (let attempt = 1; ; attempt++) {
    const order = await deps.orders.get(record.userId, orderId);
    if (!order) throw new AdminOrderNotFoundError(orderId);
    if (!canCancel(order.status, 'admin')) throw new AdminCannotCancelError(orderId, order.status);

    const now = deps.now();
    const result = await deps.orders.cancel({ order, now });
    if (result === 'cancelled') {
      // Không log địa chỉ, họ tên, SĐT (O8): chỉ ai huỷ, đơn nào, từ trạng thái nào
      logger.info('Admin huỷ đơn', { adminId: input.adminId, orderId, from: order.status });
      await notifyWorker(deps, {
        orderId,
        userId: order.userId,
        type: 'CANCELLED',
        correlationId: input.correlationId,
      });
      return cancelledSummary(order);
    }
    if (attempt >= MAX_CANCEL_ATTEMPTS) {
      // Đơn đổi liên tục (worker, khách, admin khác): báo trạng thái mới nhất đọc được
      const latest = await deps.orders.get(record.userId, orderId);
      throw new AdminCannotCancelError(orderId, latest?.status ?? order.status);
    }
  }
}

/** Chép từng trường của AdminOrderSummary (contract additionalProperties: false) */
function cancelledSummary(order: Order): AdminOrderSummary {
  const summary = toSummary(order);
  return {
    orderId: summary.orderId,
    status: 'CANCELLED',
    totalAmount: summary.totalAmount,
    itemCount: summary.itemCount,
    createdAt: summary.createdAt,
  };
}
