import {
  addItem,
  removeItem,
  toCartView,
  updateItem,
  type CartLine,
  type CartView,
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
  touchedProductId: string,
  change: (
    lines: readonly CartLine[],
    products: Awaited<ReturnType<ProductCatalog['findMany']>>,
    now: string,
  ) => CartLine[],
): Promise<CartView> {
  for (let attempt = 1; ; attempt++) {
    const stored = await deps.carts.get(userId);
    const ids = [...new Set([...stored.lines.map((l) => l.productId), touchedProductId])];
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
  return changeCart(deps, input.userId, input.productId, (lines, products, now) =>
    addItem(lines, products.get(input.productId) ?? null, input.productId, input.quantity, now),
  );
}

/** PUT /api/v1/cart/items/{productId}: đặt lại số lượng (BR-03, BR-06) */
export function updateCartItem(
  deps: CartDeps,
  input: { readonly userId: string; readonly productId: string; readonly quantity: number },
): Promise<CartView> {
  return changeCart(deps, input.userId, input.productId, (lines, products) =>
    updateItem(lines, products.get(input.productId) ?? null, input.productId, input.quantity),
  );
}

/** DELETE /api/v1/cart/items/{productId} (BR-08) */
export function removeCartItem(
  deps: CartDeps,
  input: { readonly userId: string; readonly productId: string },
): Promise<CartView> {
  return changeCart(deps, input.userId, input.productId, (lines) =>
    removeItem(lines, input.productId),
  );
}
