import { decodeOrderCursor, DEFAULT_PAGE_SIZE, encodeOrderCursor } from '../domain/history.js';
import type { OrderSummary } from '../domain/order.js';
import type { OrderHistory } from '../ports.js';

export interface ListOrdersDeps {
  readonly history: OrderHistory;
}

export interface ListOrdersInput {
  readonly userId: string;
  /** Đã kiểm 1–50 ở handler */
  readonly limit?: number;
  readonly cursor?: string;
}

/** Khớp response 200 của listOrders trong contracts/openapi.yaml */
export interface ListOrdersOutput {
  readonly items: readonly OrderSummary[];
  readonly nextCursor?: string;
}

/** Lịch sử đơn của người đang đăng nhập, mới nhất trước, phân trang cursor (#230). */
export async function listOrders(
  deps: ListOrdersDeps,
  input: ListOrdersInput,
): Promise<ListOrdersOutput> {
  // Cursor sai thì ném InvalidOrderCursorError (400) trước khi đọc bảng
  const afterOrderId = input.cursor === undefined ? undefined : decodeOrderCursor(input.cursor);
  const { orders, hasMore } = await deps.history.listByUser(input.userId, {
    limit: input.limit ?? DEFAULT_PAGE_SIZE,
    afterOrderId,
  });

  const last = orders.at(-1);
  return hasMore && last
    ? { items: orders, nextCursor: encodeOrderCursor(last.orderId) }
    : { items: orders };
}
