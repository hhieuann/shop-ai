import {
  addItem,
  mergeGuestItems,
  removeItem,
  toCartView,
  updateItem,
  type CartLine,
  type CartView,
  type GuestItem,
  type MergeAdjustment,
} from '../domain/cart.js';
import { CartVersionConflictError, type CartRepository, type ProductCatalog } from '../ports.js';

export interface CartDeps {
  readonly carts: CartRepository;
  readonly catalog: ProductCatalog;
  /** ISO 8601 UTC; test truyền giờ cố định */
  readonly now: () => string;
}

/** Hai request cùng sửa một giỏ (2 tab, bấm nhanh): đọc lại và làm lại tối đa từng này lần */
export const MAX_ATTEMPTS = 3;

/** GET /api/v1/cart: giỏ rỗng khi chưa có (tiêu chí "items [], totalAmount 0") */
export async function getCart(
  deps: CartDeps,
  input: { readonly userId: string },
): Promise<CartView> {
  const { lines } = await deps.carts.get(input.userId);
  const products = await deps.catalog.findMany(lines.map((l) => l.productId));
  return toCartView(lines, products);
}

/**
 * Khung chung cho thêm, sửa, xoá: đọc giỏ và sản phẩm mới nhất, áp luật domain, ghi có điều kiện.
 * Lỗi nghiệp vụ (409, 404) ném thẳng ra; chỉ xung đột phiên bản mới làm lại.
 */
async function changeCart(
  deps: CartDeps,
  userId: string,
  touchedProductIds: readonly string[],
  change: (
    lines: readonly CartLine[],
    products: Awaited<ReturnType<ProductCatalog['findMany']>>,
    now: string,
  ) => CartLine[],
): Promise<CartView> {
  for (let attempt = 1; ; attempt++) {
    const stored = await deps.carts.get(userId);
    const ids = [...new Set([...stored.lines.map((l) => l.productId), ...touchedProductIds])];
    const products = await deps.catalog.findMany(ids);
    const now = deps.now();
    const lines = change(stored.lines, products, now);
    try {
      await deps.carts.save(userId, lines, stored.version, now);
      return toCartView(lines, products);
    } catch (error) {
      if (!(error instanceof CartVersionConflictError) || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}

/** POST /api/v1/cart/items: thêm, cộng dồn (BR-02 … BR-04) */
export function addCartItem(
  deps: CartDeps,
  input: { readonly userId: string; readonly productId: string; readonly quantity: number },
): Promise<CartView> {
  return changeCart(deps, input.userId, [input.productId], (lines, products, now) =>
    addItem(lines, products.get(input.productId) ?? null, input.productId, input.quantity, now),
  );
}

/** PUT /api/v1/cart/items/{productId}: đặt lại số lượng (BR-03, BR-06) */
export function updateCartItem(
  deps: CartDeps,
  input: { readonly userId: string; readonly productId: string; readonly quantity: number },
): Promise<CartView> {
  return changeCart(deps, input.userId, [input.productId], (lines, products) =>
    updateItem(lines, products.get(input.productId) ?? null, input.productId, input.quantity),
  );
}

/** DELETE /api/v1/cart/items/{productId} (BR-08) */
export function removeCartItem(
  deps: CartDeps,
  input: { readonly userId: string; readonly productId: string },
): Promise<CartView> {
  return changeCart(deps, input.userId, [input.productId], (lines) =>
    removeItem(lines, input.productId),
  );
}

/** Khớp schema MergeCartResult trong contracts/openapi.yaml */
export interface MergeCartResult {
  readonly cart: CartView;
  readonly mergedExisting: string[];
  readonly adjustments: MergeAdjustment[];
}

/**
 * POST /api/v1/cart/merge: gộp giỏ khách vào giỏ tài khoản (BR-10). Chống gộp hai lần
 * (Idempotency-Key) do lambda.ts bọc bằng shared/idempotency, không nằm ở đây.
 */
export async function mergeCart(
  deps: CartDeps,
  input: { readonly userId: string; readonly items: readonly GuestItem[] },
): Promise<MergeCartResult> {
  let outcome: { mergedExisting: string[]; adjustments: MergeAdjustment[] } | undefined;
  const cart = await changeCart(
    deps,
    input.userId,
    input.items.map((i) => i.productId),
    (lines, products, now) => {
      const merged = mergeGuestItems(lines, input.items, products, now);
      outcome = { mergedExisting: merged.mergedExisting, adjustments: merged.adjustments };
      return merged.lines;
    },
  );
  // changeCart chỉ trả về sau khi đã chạy hàm gộp ở lần ghi thành công
  return {
    cart,
    mergedExisting: outcome?.mergedExisting ?? [],
    adjustments: outcome?.adjustments ?? [],
  };
}
