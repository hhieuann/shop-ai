import type { ProductCategory } from '../../../shared/api/types';

/**
 * Hiệu ứng thêm vào giỏ (design-system §9.25): một ô có icon loại hàng bay từ nút vừa bấm tới
 * icon giỏ ở header. File này giữ danh sách ô đang bay; `FlyToCart` vẽ chúng, `CartBadge` chờ
 * ô bay tới nơi rồi mới hiện số mới.
 */
export interface Flight {
  id: number;
  category?: ProductCategory;
  /** Tâm nút vừa bấm và tâm icon giỏ, toạ độ màn hình lúc bấm */
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Icon giỏ trên header đánh dấu bằng thuộc tính này */
export const CART_TARGET_ATTR = 'data-cart-target';

let flights: readonly Flight[] = [];
let nextId = 0;
/** Lớp vẽ ô bay (`FlyToCart`, tải riêng) đã gắn chưa; chưa thì không bay để nhãn số không chờ mãi */
let layerReady = false;
const listeners = new Set<() => void>();
const landListeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function subscribeFlights(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getFlights = (): readonly Flight[] => flights;

/** Còn ô nào đang bay không (nhãn số giữ số cũ tới khi bay xong) */
export const hasFlights = (): boolean => flights.length > 0;

/** Nghe lúc một ô bay tới icon giỏ */
export function onFlightLanded(listener: () => void): () => void {
  landListeners.add(listener);
  return () => landListeners.delete(listener);
}

/** `FlyToCart` gọi khi gắn (true) và khi gỡ (false) */
export function setFlightLayerReady(ready: boolean) {
  layerReady = ready;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const center = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/** Icon giỏ đang thấy được: có kích thước, nằm trong màn hình và không bị phủ (vd. panel thông số) */
function visibleTarget(): Element | null {
  const target = document.querySelector(`[${CART_TARGET_ATTR}]`);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const { x, y } = center(rect);
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
  const top = document.elementFromPoint?.(x, y);
  return top && target.contains(top) ? target : null;
}

/**
 * Gọi khi thêm vào giỏ thành công. Trả false (không bay, số đổi ngay) khi người dùng bật giảm
 * chuyển động, icon giỏ không thấy trên màn hình, hoặc lớp vẽ ô bay chưa tải xong (hay tải lỗi).
 */
export function flyToCart(from: Element | null, category?: ProductCategory): boolean {
  if (!from || !layerReady || prefersReducedMotion()) return false;
  const target = visibleTarget();
  if (!target) return false;
  flights = [
    ...flights,
    {
      id: ++nextId,
      category,
      from: center(from.getBoundingClientRect()),
      to: center(target.getBoundingClientRect()),
    },
  ];
  emit();
  return true;
}

/** Ô bay đã tới nơi (hoặc bị huỷ): bỏ khỏi danh sách, báo nhãn số cập nhật */
export function landFlight(id: number) {
  if (!flights.some((f) => f.id === id)) return;
  flights = flights.filter((f) => f.id !== id);
  emit();
  for (const listener of landListeners) listener();
}
