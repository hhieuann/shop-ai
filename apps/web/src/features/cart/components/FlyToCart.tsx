import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingCart } from 'lucide-react';
import { CategoryIcon } from '../../catalog/components/CategoryIcon';
import {
  getFlights,
  landFlight,
  setFlightLayerReady,
  subscribeFlights,
  type Flight,
} from '../lib/flyToCart';
import styles from './FlyToCart.module.css';

/** Thời gian bay (design-system §9.25) */
export const FLY_MS = 600;
/** Ô 40px nhỏ dần còn 16px khi tới icon giỏ */
const END_SCALE = 16 / 40;
const NO_FLIGHTS: readonly Flight[] = [];

/** Lớp vẽ các ô đang bay, gắn vào body; đặt một lần ở header cạnh icon giỏ */
export function FlyToCart() {
  const flights = useSyncExternalStore(subscribeFlights, getFlights, () => NO_FLIGHTS);
  // Báo lớp vẽ đã sẵn sàng: trước lúc này (chunk chưa tải, tải lỗi) flyToCart không bay
  useEffect(() => {
    setFlightLayerReady(true);
    return () => setFlightLayerReady(false);
  }, []);
  if (flights.length === 0) return null;
  return createPortal(
    flights.map((flight) => <FlyingItem key={flight.id} flight={flight} />),
    document.body,
  );
}

/**
 * Một ô bay. Đường cong: lớp ngoài chạy ngang theo --ease-standard, lớp trong chạy dọc theo ease-in,
 * hai nhịp khác nhau nên ô đi theo đường vòng; lớp trong nhỏ dần và mờ ở 20% cuối.
 */
function FlyingItem({ flight }: { flight: Flight }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    // Trình duyệt không có Web Animations: coi như tới nơi ngay
    if (!outer || !inner || typeof outer.animate !== 'function') {
      landFlight(flight.id);
      return;
    }
    const easing =
      getComputedStyle(document.documentElement).getPropertyValue('--ease-standard').trim() ||
      'ease-out';
    const { from, to } = flight;
    const horizontal = outer.animate(
      [{ transform: `translateX(${from.x}px)` }, { transform: `translateX(${to.x}px)` }],
      { duration: FLY_MS, easing, fill: 'forwards' },
    );
    const vertical = inner.animate(
      [
        { transform: `translateY(${from.y}px) scale(1)`, opacity: 1 },
        {
          transform: `translateY(${from.y + (to.y - from.y) * 0.8}px) scale(0.55)`,
          opacity: 1,
          offset: 0.8,
        },
        { transform: `translateY(${to.y}px) scale(${END_SCALE})`, opacity: 0 },
      ],
      { duration: FLY_MS, easing: 'ease-in', fill: 'forwards' },
    );
    // Bị huỷ (gỡ giữa chừng, StrictMode chạy lại effect) thì finished bị từ chối: không báo tới nơi,
    // lần gắn sau chạy lại ô bay này từ đầu nên nhãn số không kẹt ở số cũ
    vertical.finished.then(
      () => landFlight(flight.id),
      () => undefined,
    );
    return () => {
      horizontal.cancel();
      vertical.cancel();
    };
  }, [flight]);

  return (
    <div ref={outerRef} className={styles.track} aria-hidden="true">
      <div ref={innerRef} className={styles.item}>
        {flight.category ? (
          <CategoryIcon category={flight.category} size={20} />
        ) : (
          <ShoppingCart size={20} />
        )}
      </div>
    </div>
  );
}
