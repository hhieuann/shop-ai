import type { Order } from './order.js';

/**
 * Tin `order-confirmed` gửi lên SNS cho module events ghi PURCHASE (ordering.md bước 2.3).
 * Không có địa chỉ, họ tên, SĐT, giá, tên sản phẩm (threat model O8).
 */
export interface OrderConfirmedEvent {
  readonly orderId: string;
  readonly userId: string;
  readonly confirmedAt: string;
  readonly items: readonly { readonly productId: string; readonly quantity: number }[];
}

/**
 * Dựng tin từ đơn đã `CONFIRMED`. `confirmedAt` là `updatedAt` lúc chuyển trạng thái, nên lần gửi lại
 * (SQS giao lại tin) có cùng thời điểm; consumer events ghi PURCHASE theo thời điểm này.
 */
export function orderConfirmedEvent(order: Order): OrderConfirmedEvent {
  return {
    orderId: order.orderId,
    userId: order.userId,
    confirmedAt: order.updatedAt,
    items: order.items.map(({ productId, quantity }) => ({ productId, quantity })),
  };
}
