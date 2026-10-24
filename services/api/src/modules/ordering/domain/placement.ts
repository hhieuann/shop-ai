/**
 * Phần thuần của đặt hàng ngoài luật kiểm món (order.ts): băm nội dung request cho item đánh dấu
 * chống đơn trùng, và giỏ còn lại sau khi bỏ các món đã đặt (dynamodb-design.md, giao dịch đặt hàng).
 */
import { createHash } from 'node:crypto';
import type { RequestedItem, ShippingAddress } from './order.js';

/** Item đánh dấu `#KEY#<idempotencyKey>` sống 24 giờ, bằng thời hạn Idempotency-Key (BR-04) */
export const MARKER_TTL_SECONDS = 24 * 60 * 60;

/**
 * Mã băm nội dung đơn để so khi gọi lại cùng Idempotency-Key sau khi bản ghi Powertools đã mất:
 * cùng hash → trả đơn cũ, khác hash → 422 IDEMPOTENCY_KEY_REUSED.
 * Sắp món theo productId và cố định thứ tự khoá, nên đổi thứ tự món trong request không đổi hash.
 */
export function payloadHash(
  requested: readonly RequestedItem[],
  shippingAddress: ShippingAddress,
): string {
  const items = [...requested]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map(({ productId, quantity, expectedPrice }) => [productId, quantity, expectedPrice]);
  const { fullName, phone, address, province } = shippingAddress;
  const canonical = JSON.stringify({ items, address: [fullName, phone, address, province] });
  return createHash('sha256').update(canonical).digest('hex');
}

/** Giờ hết hạn của item đánh dấu, epoch giây (TTL DynamoDB trên `expiresAt`) */
export function markerExpiresAt(nowIso: string): number {
  return Math.floor(Date.parse(nowIso) / 1000) + MARKER_TTL_SECONDS;
}

/**
 * BR-09: bỏ cả dòng của các sản phẩm đã đặt, kể cả khi số lượng trong giỏ khác số đã đặt;
 * các món không chọn giữ nguyên thứ tự.
 */
export function remainingCartLines<L extends { readonly productId: string }>(
  lines: readonly L[],
  orderedProductIds: readonly string[],
): L[] {
  const ordered = new Set(orderedProductIds);
  return lines.filter((line) => !ordered.has(line.productId));
}
