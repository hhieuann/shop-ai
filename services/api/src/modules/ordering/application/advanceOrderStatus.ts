import { logger } from '../../../shared/logger.js';
import { AdminOrderNotFoundError, InvalidStatusTransitionError } from '../domain/errors.js';
import { isOrderId } from '../domain/history.js';
import {
  ORDER_STATUSES,
  previousStatus,
  type AdminTargetStatus,
  type OrderStatus,
  type AdminOrderSummary,
} from '../domain/order.js';
import type { AdminOrderRecord, AdminOrders, OrderStore } from '../ports.js';

export interface AdvanceOrderStatusDeps {
  readonly admin: Pick<AdminOrders, 'findInStatus' | 'advance'>;
  /** Đọc lại đơn theo khoá chính (đọc mạnh) khi giao dịch báo trạng thái đã đổi */
  readonly orders: Pick<OrderStore, 'get'>;
  /** ISO 8601 UTC; test truyền giờ cố định */
  readonly now: () => string;
}

export interface AdvanceOrderStatusInput {
  /** `sub` của admin trong token, chỉ để ghi log */
  readonly adminId: string;
  readonly orderId: string;
  readonly to: AdminTargetStatus;
}

/**
 * PATCH /api/v1/admin/orders/{orderId}: admin chuyển đơn đi tiếp một bước (ordering.md BR-15).
 * 1. bảng orders khoá userId + orderId nên tìm đơn qua index `byStatus`, ở trạng thái liền trước;
 * 2. không thấy thì tìm ở các trạng thái khác: thấy thì 409 kèm trạng thái đó, không thấy thì 404;
 * 3. ghi có điều kiện `status = trạng thái liền trước` (index có thể trễ), sang SHIPPED giảm `#OPEN`;
 *    điều kiện sai thì đọc lại đơn trên bảng chính và trả 409 kèm trạng thái thật.
 * Chỉ trả tóm tắt đơn, không có địa chỉ (O8).
 */
export async function advanceOrderStatus(
  deps: AdvanceOrderStatusDeps,
  input: AdvanceOrderStatusInput,
): Promise<AdminOrderSummary> {
  const { orderId, to } = input;
  if (!isOrderId(orderId)) throw new AdminOrderNotFoundError(orderId);

  const from = previousStatus(to);
  const found = await deps.admin.findInStatus(from, orderId);
  if (!found) throw await notInPreviousStatus(deps, orderId, from);

  const now = deps.now();
  const result = await deps.admin.advance({ userId: found.userId, orderId, from, to, now });
  if (result === 'statusChanged') {
    // Index còn trạng thái cũ, hoặc người khác (khách huỷ, admin khác) vừa đổi đơn
    const current = await deps.orders.get(found.userId, orderId);
    if (!current) throw new AdminOrderNotFoundError(orderId);
    throw new InvalidStatusTransitionError(orderId, current.status);
  }

  // Không log địa chỉ, họ tên, SĐT (O8): chỉ ai đổi, đơn nào, từ đâu sang đâu
  logger.info('Admin chuyển trạng thái đơn', { adminId: input.adminId, orderId, from, to });
  return summaryOf(found, to);
}

/** Lỗi trả khi không thấy đơn ở trạng thái liền trước: 409 nếu đơn ở trạng thái khác, không thì 404 */
async function notInPreviousStatus(
  deps: AdvanceOrderStatusDeps,
  orderId: string,
  from: OrderStatus,
): Promise<Error> {
  const others = ORDER_STATUSES.filter((status) => status !== from);
  const found = await Promise.all(others.map((status) => deps.admin.findInStatus(status, orderId)));
  const current = found.find((record) => record !== null);
  return current
    ? new InvalidStatusTransitionError(orderId, current.status)
    : new AdminOrderNotFoundError(orderId);
}

function summaryOf(record: AdminOrderRecord, status: AdminTargetStatus): AdminOrderSummary {
  return {
    orderId: record.orderId,
    status,
    totalAmount: record.totalAmount,
    itemCount: record.itemCount,
    createdAt: record.createdAt,
  };
}
