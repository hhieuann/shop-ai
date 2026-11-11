import { decodeOrderCursor, DEFAULT_PAGE_SIZE, encodeOrderCursor } from '../domain/history.js';
import type { AdminListStatus, OrderSummary } from '../domain/order.js';
import type { AdminOrders } from '../ports.js';

export interface ListAdminOrdersDeps {
  readonly admin: Pick<AdminOrders, 'listByStatus'>;
}

export interface ListAdminOrdersInput {
  readonly status: AdminListStatus;
  /** Đã kiểm 1–50 ở handler */
  readonly limit?: number;
  readonly cursor?: string;
}

/** Khớp response 200 của listAdminOrders trong contracts/openapi.yaml */
export interface ListAdminOrdersOutput {
  readonly items: readonly OrderSummary[];
  readonly nextCursor?: string;
}

/**
 * GET /api/v1/admin/orders: đơn theo trạng thái, mới nhất trước (ordering.md BR-15).
 * Chỉ trả tóm tắt đơn, không có địa chỉ, họ tên, SĐT, userId (threat model O8).
 */
export async function listAdminOrders(
  deps: ListAdminOrdersDeps,
  input: ListAdminOrdersInput,
): Promise<ListAdminOrdersOutput> {
  // Cursor sai thì ném InvalidOrderCursorError (400) trước khi đọc bảng
  const beforeOrderId = input.cursor === undefined ? undefined : decodeOrderCursor(input.cursor);
  const { orders, hasMore } = await deps.admin.listByStatus(input.status, {
    limit: input.limit ?? DEFAULT_PAGE_SIZE,
    beforeOrderId,
  });

  // Chép đúng các trường của tóm tắt: adapter có trả thêm gì cũng không lọt ra API
  const items = orders.map(({ orderId, status, totalAmount, itemCount, createdAt }) => ({
    orderId,
    status,
    totalAmount,
    itemCount,
    createdAt,
  }));
  const last = items.at(-1);
  return hasMore && last ? { items, nextCursor: encodeOrderCursor(last.orderId) } : { items };
}
