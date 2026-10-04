/**
 * cart.md BR-01: khách chưa đăng nhập bấm "Thêm vào giỏ" → đi đăng nhập → quay lại thì tự thêm.
 * Ghi nhớ món định thêm vào sessionStorage trong lúc đi đăng nhập.
 */
export interface PendingAdd {
  productId: string;
  quantity: number;
}

const KEY = 'shop-ai:pending-add';

export function savePendingAdd(pending: PendingAdd) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // bỏ qua: khách chỉ phải bấm lại sau khi đăng nhập
  }
}

/**
 * Lấy ra VÀ xoá luôn món đang chờ của sản phẩm này (chỉ dùng được một lần).
 * Xoá ngay khi đọc để React StrictMode chạy effect hai lần cũng không thêm hai lần.
 */
export function takePendingAdd(productId: string): PendingAdd | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingAdd;
    if (pending.productId !== productId) return null;
    sessionStorage.removeItem(KEY);
    return pending;
  } catch {
    return null;
  }
}
