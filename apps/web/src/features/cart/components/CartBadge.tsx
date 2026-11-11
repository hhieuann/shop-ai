import { useEffect, useRef, useState } from 'react';
import { hasFlights, onFlightLanded, prefersReducedMotion } from '../lib/flyToCart';
import styles from './CartBadge.module.css';

/** Nhãn nảy khi ô bay tới nơi (design-system §9.25) */
const BOUNCE_MS = 200;

/**
 * Nhãn số trên icon giỏ ở header (design-system §9.1). `count` là số dòng trong giỏ (useCartCount).
 * Đang có ô bay (flyToCart) thì giữ số cũ, ô tới nơi mới hiện số mới và nảy nhẹ.
 * Không có ô bay (giảm chuyển động, icon giỏ bị che, hiệu ứng chưa tải xong hoặc tải lỗi, giỏ đổi ở
 * tab khác) thì số đổi ngay.
 * Chỉ để nhìn: số đọc qua aria-label của link giỏ.
 */
export function CartBadge({ count }: { count: number }) {
  const [shown, setShown] = useState(count);
  const [bounce, setBounce] = useState(0);
  const latest = useRef(count);
  latest.current = count;
  const badgeRef = useRef<HTMLSpanElement>(null);

  // Số đổi: chờ một nhịp để nút kịp bắt đầu ô bay (bắt đầu ngay sau khi giỏ đổi), không có thì đổi luôn
  useEffect(() => {
    if (count === shown) return;
    const id = setTimeout(() => {
      if (!hasFlights()) setShown(latest.current);
    }, 0);
    return () => clearTimeout(id);
  }, [count, shown]);

  // Ô bay tới nơi: hiện số mới nhất và nảy (thêm lại món đã có thì số giữ nguyên, chỉ nảy)
  useEffect(
    () =>
      onFlightLanded(() => {
        setShown(latest.current);
        setBounce((n) => n + 1);
      }),
    [],
  );

  useEffect(() => {
    const badge = badgeRef.current;
    if (bounce === 0 || !badge || typeof badge.animate !== 'function') return;
    if (prefersReducedMotion()) return;
    const easing = getComputedStyle(badge).getPropertyValue('--ease-standard').trim() || 'ease-out';
    const animation = badge.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: BOUNCE_MS, easing },
    );
    return () => animation.cancel();
  }, [bounce]);

  if (shown <= 0) return null;
  return (
    <span ref={badgeRef} className={styles.badge} aria-hidden="true" data-testid="cart-badge">
      {shown}
    </span>
  );
}
