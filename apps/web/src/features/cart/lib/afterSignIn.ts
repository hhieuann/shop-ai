/**
 * Gộp giỏ khách vào giỏ tài khoản sau khi đăng nhập (cart.md BR-10) và quyết định đi tiếp
 * tới đâu (BR-11).
 *
 * Trang đăng nhập / tạo tài khoản chỉ cần gọi continueAfterSignIn() sau khi thành công.
 * Mọi logic giỏ nằm ở đây, trang đăng nhập không phải biết.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Cart, CartItem, MergeCartResult } from '../../../shared/api/types';
import { clearGuestCart, loadGuestCart, type GuestLine } from './guestCart';
import { canSelect } from './selection';

// ── Ý định đặt hàng của khách vãng lai ────────────────────────────────────────
// Khách bấm "Đặt hàng" khi chưa đăng nhập → nhớ các món đã tick, để sau khi đăng nhập
// đưa thẳng tới checkout với đúng các món đó. sessionStorage: chỉ trong tab này, đóng tab là mất.

export interface CheckoutIntent {
  items: { productId: string; quantity: number }[];
}

const INTENT_KEY = 'shop-ai:checkout-intent';
const MERGE_KEY = 'shop-ai:merge-idempotency-key';

export function saveCheckoutIntent(intent: CheckoutIntent) {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  } catch {
    // không lưu được: sau khi đăng nhập khách về trang giỏ và bấm "Đặt hàng" lại
  }
}

function takeCheckoutIntent(): CheckoutIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as CheckoutIntent;
    return Array.isArray(intent.items) && intent.items.length > 0 ? intent : null;
  } catch {
    return null;
  }
}

/**
 * Idempotency-Key cho lần gộp (BR-10): giữ nguyên tới khi gộp xong, để gọi lại sau lỗi mạng
 * không cộng dồn hai lần; gộp xong thì bỏ.
 */
function mergeKey(): string {
  try {
    const existing = sessionStorage.getItem(MERGE_KEY);
    if (existing) return existing;
    const key = crypto.randomUUID();
    sessionStorage.setItem(MERGE_KEY, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

function dropMergeKey() {
  try {
    sessionStorage.removeItem(MERGE_KEY);
  } catch {
    // bỏ qua
  }
}

// ── Quyết định sau khi gộp (BR-11), hàm thuần để test ────────────────────────

export type AfterMerge =
  { to: 'checkout'; selectedItems: CartItem[] } | { to: 'cart' } | { to: 'from' };

/**
 * Sang thẳng checkout chỉ khi mọi món khách đã tick được gộp đúng số lượng đã chọn và
 * vẫn đặt được. Có món trùng giỏ tài khoản, bị chặn hay bỏ qua → về giỏ để khách xem lại.
 */
export function decideAfterMerge(
  intent: CheckoutIntent | null,
  result: MergeCartResult,
): AfterMerge {
  // Đăng nhập theo cách khác (nút "Tài khoản"): vẫn gộp, rồi ở lại trang đang xem (BR-11)
  if (!intent) return { to: 'from' };

  const changed = result.mergedExisting ?? [];

  const touched = new Set([...changed, ...result.adjustments.map((a) => a.productId)]);
  const selectedItems: CartItem[] = [];
  for (const wanted of intent.items) {
    const item = result.cart.items.find((i) => i.productId === wanted.productId);
    if (
      touched.has(wanted.productId) ||
      !item ||
      item.quantity !== wanted.quantity ||
      !canSelect(item)
    ) {
      return { to: 'cart' };
    }
    selectedItems.push(item);
  }
  return { to: 'checkout', selectedItems };
}

// ── Đăng xuất ────────────────────────────────────────────────────────────────

/**
 * Gọi ngay sau khi đăng xuất (account.md BR-09, cart.md dòng "đăng nhập rồi đăng xuất"):
 * giỏ khách trên trình duyệt bắt đầu lại từ rỗng, bỏ khoá gộp và ý định đặt hàng của phiên cũ,
 * và xoá giỏ tài khoản khỏi bộ nhớ đệm để người dùng chung máy không thấy lại.
 * Bình thường giỏ khách đã rỗng vì gộp lúc đăng nhập thành công là xoá; hàm này lo nốt trường hợp
 * gộp lỗi mà khách đăng xuất trước khi bấm "Gộp vào giỏ" (các món đó bỏ, cart.md BR-10).
 */
export function clearCartSession(queryClient: QueryClient) {
  clearGuestCart();
  dropMergeKey();
  try {
    sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // bỏ qua
  }
  queryClient.removeQueries({ queryKey: queryKeys.cart.all });
}

// ── Gộp và đi tiếp ───────────────────────────────────────────────────────────

export async function mergeGuestCart(lines: readonly GuestLine[]): Promise<MergeCartResult> {
  return api.post<MergeCartResult>(
    '/cart/merge',
    { items: lines.map(({ productId, quantity }) => ({ productId, quantity })) },
    { headers: { 'Idempotency-Key': mergeKey() } },
  );
}

// Đang gộp (React StrictMode chạy effect hai lần, khách bấm hai lần): dùng chung một lần gọi
let inFlight: Promise<MergeCartResult | null> | null = null;

/**
 * Gộp giỏ khách đang có (nếu có), xoá giỏ khách khi gộp xong, cập nhật cache giỏ.
 * Trả null nếu không có gì để gộp. Lỗi thì giữ nguyên giỏ khách và ném lỗi ra.
 */
export function mergeGuestCartIfAny(queryClient: QueryClient): Promise<MergeCartResult | null> {
  if (inFlight) return inFlight;
  const lines = loadGuestCart();
  if (lines.length === 0) return Promise.resolve(null);

  inFlight = mergeGuestCart(lines)
    .then((result) => {
      clearGuestCart();
      dropMergeKey();
      queryClient.setQueryData<Cart>(queryKeys.cart.mine(), result.cart);
      return result;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Gọi ngay sau khi đăng nhập hoặc tạo tài khoản thành công.
 * `from`: trang cần quay lại khi khách không đến từ nút "Đặt hàng".
 */
export async function continueAfterSignIn(
  navigate: NavigateFunction,
  queryClient: QueryClient,
  from: string,
): Promise<void> {
  const intent = takeCheckoutIntent();
  // Giỏ tài khoản của người vừa đăng nhập khác giỏ khách: bỏ cache cũ
  await queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });

  let result: MergeCartResult | null;
  try {
    result = await mergeGuestCartIfAny(queryClient);
  } catch {
    // Gộp lỗi: giỏ khách vẫn còn; trang giỏ hiện khung cảnh báo kèm nút "Gộp vào giỏ" để thử lại
    navigate('/cart', { replace: true });
    return;
  }

  if (!result) {
    // Không có giỏ khách: đến từ "Đặt hàng" mà giỏ khách trống (vd. đã gộp ở tab khác) → về giỏ
    navigate(intent ? '/cart' : from, { replace: true });
    return;
  }

  const next = decideAfterMerge(intent, result);
  if (next.to === 'checkout') {
    navigate('/checkout', { replace: true, state: { selectedItems: next.selectedItems } });
  } else if (next.to === 'cart') {
    navigate('/cart', { replace: true });
  } else {
    navigate(from, { replace: true });
  }
}
