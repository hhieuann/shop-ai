/**
 * Giữ danh sách món đang checkout trong sessionStorage (chỉ tab hiện tại, đóng tab là mất).
 * Dùng sessionStorage chứ không phải localStorage: checkout là việc đang làm dở trong một tab,
 * không nên "sống lại" vài ngày sau với giá cũ.
 * Mọi thao tác bọc try/catch: trình duyệt có thể chặn storage (chế độ riêng tư...).
 */
export interface CheckoutItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

const KEY = 'shop-ai:checkout-items';

export function saveCheckoutItems<T extends CheckoutItem>(items: T[]): T[] {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // không lưu được thì thôi; trang vẫn chạy, chỉ mất khi F5
  }
  return items;
}

export function loadCheckoutItems(): CheckoutItem[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CheckoutItem[]) : [];
  } catch {
    return [];
  }
}

export function clearCheckoutItems() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
}
