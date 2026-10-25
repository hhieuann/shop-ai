import { OrderNotFoundError } from '../domain/errors.js';
import { isOrderId } from '../domain/history.js';
import type { Order } from '../domain/order.js';
import type { OrderStore } from '../ports.js';

export interface GetOrderDeps {
  readonly orders: Pick<OrderStore, 'get'>;
}

/**
 * Chi tiết một đơn của người đang đăng nhập (#230). Khoá đọc gồm userId của token, nên đơn của
 * người khác cũng như không có: 404, không để lộ đơn đó có tồn tại (ordering.md).
 * orderId sai dạng cũng 404 (contract getOrder không có 400) và không tốn một lần đọc bảng.
 */
export async function getOrder(
  deps: GetOrderDeps,
  input: { readonly userId: string; readonly orderId: string },
): Promise<Order> {
  if (!isOrderId(input.orderId)) throw new OrderNotFoundError(input.orderId);
  const order = await deps.orders.get(input.userId, input.orderId);
  if (!order) throw new OrderNotFoundError(input.orderId);
  return order;
}
