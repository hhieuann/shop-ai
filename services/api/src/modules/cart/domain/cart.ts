/**
 * Luật giỏ hàng của khách đã đăng nhập (docs/business/cart.md). Hàm thuần, không I/O:
 * nhận giỏ cũ và thông tin sản phẩm, trả giỏ mới hoặc ném lỗi nghiệp vụ.
 * Cùng luật với giỏ khách trên trình duyệt (apps/web/src/features/cart/lib/guestCart.ts).
 */
import {
  CartFullError,
  CartItemNotFoundError,
  ProductNotFoundError,
  ProductUnavailableError,
  QuantityLimitError,
} from './errors.js';

/** BR-02: tối đa 50 dòng mỗi giỏ */
export const MAX_LINES = 50;
/** BR-03: tối đa 99 mỗi món */
export const MAX_QUANTITY = 99;

/** Một dòng lưu trong bảng carts (dynamodb-design.md, bảng carts) */
export interface CartLine {
  readonly productId: string;
  readonly quantity: number;
  /** Giá lúc thêm hoặc sửa số lượng gần nhất (BR-06) */
  readonly addedPrice: number;
  /** ISO 8601 UTC, lúc món vào giỏ lần đầu */
  readonly addedAt: string;
}

/** Thông tin sản phẩm cart cần, đọc mới mỗi lần qua port ProductCatalog */
export interface ProductSnapshot {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly price: number;
  readonly stock: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

/** Dòng giỏ trả cho web, khớp schema CartItem trong contracts/openapi.yaml */
export interface CartItemView {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly price: number;
  readonly quantity: number;
  readonly stock: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly priceChanged: boolean;
}

/** Khớp schema Cart trong contracts/openapi.yaml */
export interface CartView {
  readonly items: CartItemView[];
  readonly totalAmount: number;
}

/** Tên hiện cho món đã bị xoá khỏi catalog; giống giỏ khách trên web */
export const REMOVED_PRODUCT_NAME = 'Sản phẩm không còn bán';

/** BR-03: số lượng tối đa của một dòng = min(99, tồn kho), không âm */
export function lineLimit(stock: number): number {
  return Math.max(0, Math.min(MAX_QUANTITY, stock));
}

/** BR-07: món đặt được khi đang bán và đủ hàng cho số lượng trong giỏ */
export function isOrderable(item: Pick<CartItemView, 'status' | 'stock' | 'quantity'>): boolean {
  return item.status === 'ACTIVE' && item.stock >= item.quantity;
}

/**
 * Thêm món, đã có thì cộng dồn (BR-04). Thứ tự kiểm giống giỏ khách:
 * không tồn tại → ngừng bán → vượt giới hạn → giỏ đầy. Lỗi thì giỏ giữ nguyên.
 * Thêm lại món đã có cũng cập nhật addedPrice, nên cờ "Giá đã thay đổi" mất (BR-06).
 */
export function addItem(
  lines: readonly CartLine[],
  product: ProductSnapshot | null,
  productId: string,
  quantity: number,
  now: string,
): CartLine[] {
  if (!product) throw new ProductNotFoundError(productId);
  if (product.status !== 'ACTIVE') throw new ProductUnavailableError(productId);

  const existing = lines.find((l) => l.productId === productId);
  const current = existing?.quantity ?? 0;
  const limit = lineLimit(product.stock);
  if (current + quantity > limit) throw new QuantityLimitError(Math.max(0, limit - current));
  if (!existing && lines.length >= MAX_LINES) throw new CartFullError();

  if (existing) {
    return lines.map((l) =>
      l.productId === productId
        ? { ...l, quantity: current + quantity, addedPrice: product.price }
        : l,
    );
  }
  return [...lines, { productId, quantity, addedPrice: product.price, addedAt: now }];
}

/**
 * Đặt lại số lượng một dòng (1 … min(99, tồn kho)), cập nhật addedPrice (BR-06).
 * Sản phẩm đã bị xoá khỏi catalog: không biết tồn kho nên chỉ cho xoá (QUANTITY_LIMIT, maxAddable 0).
 */
export function updateItem(
  lines: readonly CartLine[],
  product: ProductSnapshot | null,
  productId: string,
  quantity: number,
): CartLine[] {
  if (!lines.some((l) => l.productId === productId)) throw new CartItemNotFoundError(productId);
  if (!product) throw new QuantityLimitError(0);

  const limit = lineLimit(product.stock);
  if (quantity > limit) throw new QuantityLimitError(limit);

  return lines.map((l) =>
    l.productId === productId ? { ...l, quantity, addedPrice: product.price } : l,
  );
}

/** Xoá một dòng (BR-08: không ảnh hưởng catalog) */
export function removeItem(lines: readonly CartLine[], productId: string): CartLine[] {
  if (!lines.some((l) => l.productId === productId)) throw new CartItemNotFoundError(productId);
  return lines.filter((l) => l.productId !== productId);
}

/**
 * Giỏ trả cho web: giá, tồn kho, trạng thái luôn lấy mới từ catalog (BR-06);
 * totalAmount chỉ tính món đặt được (BR-07, BR-09).
 * Món đã bị xoá khỏi catalog vẫn hiện, như món ngừng bán, để khách tự xoá.
 */
export function toCartView(
  lines: readonly CartLine[],
  products: ReadonlyMap<string, ProductSnapshot>,
): CartView {
  const items = lines.map((line): CartItemView => {
    const product = products.get(line.productId);
    if (!product) {
      return {
        productId: line.productId,
        name: REMOVED_PRODUCT_NAME,
        price: line.addedPrice,
        quantity: line.quantity,
        stock: 0,
        status: 'INACTIVE',
        priceChanged: false,
      };
    }
    return {
      productId: line.productId,
      name: product.name,
      ...(product.imageUrl !== undefined ? { imageUrl: product.imageUrl } : {}),
      price: product.price,
      quantity: line.quantity,
      stock: product.stock,
      status: product.status,
      priceChanged: product.price !== line.addedPrice,
    };
  });

  const totalAmount = items
    .filter(isOrderable)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { items, totalAmount };
}

// ── Gộp giỏ khách khi đăng nhập (BR-10) ──────────────────────────────────────

/** Một món trong giỏ khách web gửi lên (MergeCartRequest) */
export interface GuestItem {
  readonly productId: string;
  readonly quantity: number;
}

/** Lý do một món không được gộp đúng như yêu cầu, khớp enum MergeAdjustment.reason */
export type MergeReason =
  'QUANTITY_LIMITED' | 'PRODUCT_UNAVAILABLE' | 'OUT_OF_STOCK' | 'NOT_FOUND' | 'CART_FULL';

/** Khớp schema MergeAdjustment trong contracts/openapi.yaml */
export interface MergeAdjustment {
  readonly productId: string;
  readonly reason: MergeReason;
  /** Số lượng trong giỏ khách */
  readonly requested: number;
  /** Số lượng thực sự cộng thêm vào giỏ tài khoản (0 nếu bỏ qua) */
  readonly merged: number;
}

export interface MergeOutcome {
  readonly lines: CartLine[];
  /** productId của các món đã có sẵn trong giỏ tài khoản nên được cộng dồn */
  readonly mergedExisting: string[];
  readonly adjustments: MergeAdjustment[];
}

/**
 * Gộp giỏ khách vào giỏ tài khoản (BR-10). Không ném lỗi cho từng món: mọi điều chỉnh nằm trong
 * `adjustments`, để web quyết định đi tiếp tới đâu (BR-11).
 * - Món đã có: cộng dồn nhưng không vượt min(99, tồn kho); phần vượt bị bỏ (QUANTITY_LIMITED).
 * - Món mới: thêm dòng nếu giỏ còn dưới 50 dòng (CART_FULL nếu đầy), cũng chặn theo giới hạn.
 * - Không còn trong catalog, ngừng bán, hết hàng: bỏ qua.
 * Món được cộng thêm cập nhật addedPrice (BR-06), như khi thêm lại bằng nút "Thêm vào giỏ".
 */
export function mergeGuestItems(
  lines: readonly CartLine[],
  guestItems: readonly GuestItem[],
  products: ReadonlyMap<string, ProductSnapshot>,
  now: string,
): MergeOutcome {
  const result: CartLine[] = [...lines];
  const mergedExisting: string[] = [];
  const adjustments: MergeAdjustment[] = [];
  const skip = (item: GuestItem, reason: MergeReason) =>
    adjustments.push({ productId: item.productId, reason, requested: item.quantity, merged: 0 });

  for (const item of guestItems) {
    const product = products.get(item.productId);
    if (!product) {
      skip(item, 'NOT_FOUND');
      continue;
    }
    if (product.status !== 'ACTIVE') {
      skip(item, 'PRODUCT_UNAVAILABLE');
      continue;
    }
    if (product.stock <= 0) {
      skip(item, 'OUT_OF_STOCK');
      continue;
    }

    const limit = lineLimit(product.stock);
    const index = result.findIndex((l) => l.productId === item.productId);
    const existing = index >= 0 ? result[index] : undefined;
    if (!existing && result.length >= MAX_LINES) {
      skip(item, 'CART_FULL');
      continue;
    }

    const current = existing?.quantity ?? 0;
    const added = Math.min(item.quantity, Math.max(0, limit - current));
    if (existing) {
      mergedExisting.push(item.productId);
      if (added > 0) {
        result[index] = { ...existing, quantity: current + added, addedPrice: product.price };
      }
    } else {
      result.push({
        productId: item.productId,
        quantity: added,
        addedPrice: product.price,
        addedAt: now,
      });
    }
    if (added < item.quantity) {
      adjustments.push({
        productId: item.productId,
        reason: 'QUANTITY_LIMITED',
        requested: item.quantity,
        merged: added,
      });
    }
  }
  return { lines: result, mergedExisting, adjustments };
}
