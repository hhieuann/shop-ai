/** Phần tử Tab tới được trong hộp thoại (bỏ qua phần tử vô hiệu) */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** Phần của sự kiện bàn phím cần dùng; nhận được cả sự kiện React và sự kiện gốc */
interface TabKeyEvent {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}

/**
 * Giữ focus trong hộp thoại modal: Tab ở phần tử cuối quay về phần tử đầu, Shift+Tab ở phần tử
 * đầu sang phần tử cuối. Gọi trong onKeyDown của khung hộp thoại.
 */
export function trapTabKey(event: TabKeyEvent, container: HTMLElement | null): void {
  if (event.key !== 'Tab' || !container) return;
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
