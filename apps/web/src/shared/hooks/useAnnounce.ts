import { createContext, useContext } from 'react';

export interface Announcer {
  /** Thông báo trạng thái, đọc khi trình đọc màn hình rảnh (aria-live="polite"), vd. "Đã thêm … vào giỏ." */
  polite(text: string): void;
  /** Lỗi cần biết ngay (role="alert"), vd. câu đầy đủ khi không thêm được vào giỏ */
  alert(text: string): void;
}

const noop: Announcer = { polite: () => {}, alert: () => {} };

/** Do LiveAnnouncerProvider cung cấp; không có provider thì không đọc gì (component vẫn chạy) */
export const AnnouncerContext = createContext<Announcer>(noop);

/**
 * Gửi câu cho trình đọc màn hình qua vùng thông báo đặt một lần ở cấp trang
 * (design-system §9.23: không lặp vùng aria-live, role="alert" trong từng thẻ).
 */
export function useAnnounce(): Announcer {
  return useContext(AnnouncerContext);
}
