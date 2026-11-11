import { useEffect, useState } from 'react';

/**
 * true khi trang đã cuộn khỏi đầu (`scrollY > 0`). Chỉ theo dõi khi `enabled`.
 * Listener `scroll` passive, chỉ đọc `scrollY` (không đo layout), chỉ đổi state khi kết quả đổi
 * (design-system §9.1 "Hàng 2 thu lại khi cuộn").
 */
export function useScrolledDown(enabled: boolean): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setScrolled(false);
      return;
    }
    // Vào trang khi đang ở giữa trang thì đúng ngay từ đầu
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [enabled]);

  return scrolled;
}
