import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';
import styles from './Carousel.module.css';

/**
 * Dải sản phẩm (design-system §9.11): 7 thẻ từ 1600px, 6 thẻ từ 1280px, thẻ 220px cuộn ngang
 * ở 768–1279px, lưới 2 cột 4 thẻ đầu dưới 768px.
 * Nút mũi tên kính chỉ hiện từ 1280px và chỉ khi còn thẻ ở hướng đó. Không tự chạy.
 */
interface CarouselProps {
  label: string;
  children: ReactNode;
}

export function Carousel({ label, children }: CarouselProps) {
  const { ref, canPrev, canNext, scrollByPage, update } = useHorizontalScroll<HTMLUListElement>();

  // Số ô thay đổi (ví dụ: khung chờ → sản phẩm thật) → tính lại nút
  useEffect(update, [children, update]);

  return (
    // role="group" chứ không phải "region": dải cuộn nằm trong một khối đã có tên (StoryBlock),
    // hai vùng điều hướng trùng tên làm trình đọc màn hình đọc lặp
    <div
      className={styles.carousel}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
    >
      {canPrev && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.prev}`}
          onClick={() => scrollByPage(-1)}
          aria-label={`${label}: xem trước`}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      )}
      <ul ref={ref} className={styles.track}>
        {children}
      </ul>
      {canNext && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.next}`}
          onClick={() => scrollByPage(1)}
          aria-label={`${label}: xem tiếp`}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Một ô trong Carousel */
export function CarouselItem({ children }: { children: ReactNode }) {
  return <li className={styles.item}>{children}</li>;
}
