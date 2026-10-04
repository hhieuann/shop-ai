import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Theo dõi một dải cuộn ngang: còn cuộn được sang trái / phải không, và hàm cuộn theo trang.
 * Dùng chung cho carousel và hàng chip loại hàng, để nút ‹ › chỉ hiện khi thật sự cuộn được
 * (ẩn nút ở đầu và cuối dải).
 */
export function useHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Sai số 1px vì trình duyệt làm tròn scrollLeft khi phóng to/thu nhỏ trang
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Đổi kích thước cửa sổ hoặc dữ liệu tải xong làm dải dài/ngắn đi → tính lại
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [update]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  return { ref, canPrev, canNext, scrollByPage, update };
}
