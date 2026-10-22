/**
 * Giỏ của khách vãng lai, lưu trên trình duyệt (cart.md BR-01).
 *
 * Chỉ lưu productId, số lượng, giá lúc thêm. Tên, ảnh, giá, tồn kho luôn lấy mới từ catalog
 * khi hiển thị (useCart). Các hàm sửa giỏ là hàm thuần: nhận giỏ cũ, trả giỏ mới hoặc lỗi
 * cùng mã với API (`QUANTITY_LIMIT`, `CART_FULL`, `PRODUCT_UNAVAILABLE`), để trang giỏ
 * và nút "Thêm vào giỏ" báo lỗi giống hệt khi đã đăng nhập.
 */

export interface GuestLine {
  productId: string;
  quantity: number;
  /** Giá lúc thêm hoặc sửa số lượng gần nhất; khác giá hiện tại thì báo "Giá đã thay đổi" (BR-06) */
  addedPrice: number;
}

/** Những gì cần biết về sản phẩm để kiểm giới hạn (lấy từ GET /products/{id}) */
export interface ProductFacts {
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export type GuestCartError =
  | { code: 'QUANTITY_LIMIT'; maxAddable: number }
  | { code: 'CART_FULL' }
  | { code: 'PRODUCT_UNAVAILABLE' };

export type GuestCartResult =
  { ok: true; lines: GuestLine[] } | { ok: false; error: GuestCartError };

export const MAX_LINES = 50; // BR-02
export const MAX_QUANTITY = 99; // BR-03

/** Số lượng tối đa của một dòng: min(99, tồn kho) (BR-03) */
export const lineLimit = (stock: number) => Math.max(0, Math.min(MAX_QUANTITY, stock));

/** Thêm món; đã có thì cộng dồn (BR-04). Vượt giới hạn thì giữ nguyên giỏ và báo còn thêm được bao nhiêu */
export function addLine(
  lines: readonly GuestLine[],
  productId: string,
  quantity: number,
  product: ProductFacts,
): GuestCartResult {
  if (product.status !== 'ACTIVE') return { ok: false, error: { code: 'PRODUCT_UNAVAILABLE' } };
  const existing = lines.find((l) => l.productId === productId);
  const current = existing?.quantity ?? 0;
  const limit = lineLimit(product.stock);
  if (current + quantity > limit) {
    return {
      ok: false,
      error: { code: 'QUANTITY_LIMIT', maxAddable: Math.max(0, limit - current) },
    };
  }
  if (!existing && lines.length >= MAX_LINES) return { ok: false, error: { code: 'CART_FULL' } };

  const line: GuestLine = { productId, quantity: current + quantity, addedPrice: product.price };
  return {
    ok: true,
    lines: existing ? lines.map((l) => (l.productId === productId ? line : l)) : [...lines, line],
  };
}

/** Sửa số lượng một dòng (1 … min(99, tồn kho)); cập nhật luôn giá lúc thêm nên cờ đổi giá mất (BR-06) */
export function setLineQuantity(
  lines: readonly GuestLine[],
  productId: string,
  quantity: number,
  product: ProductFacts,
): GuestCartResult {
  const limit = lineLimit(product.stock);
  if (quantity > limit) {
    return { ok: false, error: { code: 'QUANTITY_LIMIT', maxAddable: limit } };
  }
  return {
    ok: true,
    lines: lines.map((l) =>
      l.productId === productId
        ? { productId, quantity: Math.max(1, quantity), addedPrice: product.price }
        : l,
    ),
  };
}

export function removeLine(lines: readonly GuestLine[], productId: string): GuestLine[] {
  return lines.filter((l) => l.productId !== productId);
}

/**
 * Đọc giỏ từ chuỗi đã lưu. Dữ liệu trên trình duyệt có thể bị sửa tay: bỏ dòng hỏng,
 * bỏ dòng trùng productId, cắt còn tối đa 50 dòng. Server vẫn kiểm lại khi gộp.
 */
export function parseGuestCart(raw: string | null): GuestLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const lines: GuestLine[] = [];
  for (const row of data) {
    if (typeof row !== 'object' || row === null) continue;
    const { productId, quantity, addedPrice } = row as Record<string, unknown>;
    if (typeof productId !== 'string' || productId.length === 0 || productId.length > 64) continue;
    if (!Number.isInteger(quantity) || (quantity as number) < 1) continue;
    if (!Number.isInteger(addedPrice) || (addedPrice as number) < 0) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    lines.push({
      productId,
      quantity: Math.min(MAX_QUANTITY, quantity as number),
      addedPrice: addedPrice as number,
    });
    if (lines.length === MAX_LINES) break;
  }
  return lines;
}

// ── Lưu trên trình duyệt ─────────────────────────────────────────────────────
// localStorage (không phải sessionStorage): đóng mở trình duyệt vẫn còn giỏ.
// Mọi thao tác bọc try/catch: trình duyệt có thể chặn storage (chế độ riêng tư…).

const KEY = 'shop-ai:guest-cart';
const CHANGE_EVENT = 'shop-ai:guest-cart-change';

let cachedRaw: string | null = null;
let cachedLines: GuestLine[] = [];

/** Giỏ khách hiện tại. Trả cùng một mảng khi dữ liệu không đổi (dùng được với useSyncExternalStore) */
export function loadGuestCart(): GuestLine[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parseGuestCart(raw);
  }
  return cachedLines;
}

export function saveGuestCart(lines: readonly GuestLine[]) {
  try {
    if (lines.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Không lưu được thì thôi; giỏ chỉ mất khi tải lại trang
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearGuestCart() {
  saveGuestCart([]);
}

/** Nghe thay đổi giỏ khách, cả từ tab khác (sự kiện storage) */
export function subscribeGuestCart(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}
