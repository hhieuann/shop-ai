import { z } from 'zod';
import { expiresAt, purchaseEventId, type StoredEvent } from '../domain/event.js';
import type { EventRepository, UserIdHasher } from '../ports.js';

/**
 * Tin `order-confirmed` do `order-processor` của ordering gửi (ordering.md bước 2.3, events.md mục 1).
 * Không có `shippingAddress` (threat model O8); thừa trường nào thì bỏ qua, thiếu hoặc sai kiểu thì từ chối.
 */
export const orderConfirmedSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  confirmedAt: z.iso.datetime(),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1),
});
export type OrderConfirmedMessage = z.infer<typeof orderConfirmedSchema>;

export interface RecordPurchaseDeps {
  readonly events: Pick<EventRepository, 'putOnce'>;
  readonly hasher: UserIdHasher;
}

export interface RecordPurchaseResult {
  /** Số dòng PURCHASE mới ghi */
  readonly written: number;
  /** Số dòng đã có từ lần giao trước của cùng tin, không ghi lại */
  readonly duplicates: number;
}

/**
 * Ghi mỗi sản phẩm trong đơn thành một sự kiện PURCHASE.
 * - Thời điểm sự kiện là `confirmedAt` của ordering, không phải giờ consumer chạy, để tin đến muộn
 *   (thử lại, DLQ gửi lại) vẫn nằm đúng ngày trong cửa sổ bán chạy 30/90/365 ngày.
 * - Cùng sản phẩm xuất hiện nhiều dòng thì cộng số lượng thành một sự kiện.
 * - Khoá suy ra từ `orderId` và `productId`, nên tin giao lại không tạo lượt mua thứ hai.
 */
export async function recordPurchase(
  deps: RecordPurchaseDeps,
  message: OrderConfirmedMessage,
): Promise<RecordPurchaseResult> {
  const userIdHash = await deps.hasher.hash(message.userId);
  const timestamp = new Date(message.confirmedAt).toISOString();

  const quantities = new Map<string, number>();
  for (const item of message.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  let written = 0;
  let duplicates = 0;
  for (const [productId, quantity] of quantities) {
    const event: StoredEvent = {
      userIdHash,
      eventId: purchaseEventId(message.orderId, productId),
      productId,
      eventType: 'PURCHASE',
      timestamp,
      ttl: expiresAt(timestamp),
      orderId: message.orderId,
      quantity,
    };
    if (await deps.events.putOnce(event)) written += 1;
    else duplicates += 1;
  }
  return { written, duplicates };
}
