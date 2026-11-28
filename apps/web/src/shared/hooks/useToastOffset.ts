import { useLayoutEffect, type RefObject } from 'react';

/** Biến CSS cộng thêm vào khoảng cách đáy của vùng thông báo nổi (design-system §9.33) */
export const TOAST_OFFSET_VAR = '--toast-offset-bottom';

/**
 * Đẩy thông báo nổi lên trên một thanh dính đáy (vd. thanh "Lưu sản phẩm" của form admin), để thông
 * báo không che nút của thanh. Thông báo vẽ qua portal vào `body` nên không thừa hưởng biến của trang:
 * đặt biến trên `<html>` bằng chiều cao thanh, đo lại khi thanh đổi cao (xuống dòng ở điện thoại), gỡ
 * khi rời trang.
 */
export function useToastOffset(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty(TOAST_OFFSET_VAR, `${el.offsetHeight}px`);
    apply();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(TOAST_OFFSET_VAR);
    };
  }, [ref]);
}
