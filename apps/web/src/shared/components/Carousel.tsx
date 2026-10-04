import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';
import styles from './Carousel.module.css';

/**
 * Dải cuộn ngang: cuộn bằng tay/trackpad, có nút trái/phải hiện khi rê chuột.
 * Nút chỉ hiện khi còn nội dung để cuộn theo hướng đó. Không tự chạy; không chấm phân trang.
 */
interface CarouselProps {
  label: string;
  /** Căn giữa các ô khi còn chỗ (dải ngắn như Danh mục). Hàng sản phẩm thì để căn trái. */
  centered?: boolean;
  children: ReactNode;
}

export function Carousel({ label, centered = false, children }: CarouselProps) {
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
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
      )}
      <ul ref={ref} className={`${styles.track} ${centered ? styles.centered : ''}`}>
        {children}
      </ul>
      {canNext && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.next}`}
          onClick={() => scrollByPage(1)}
          aria-label={`${label}: xem tiếp`}
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Một ô trong Carousel */
export function CarouselItem({ children }: { children: ReactNode }) {
  return <li className={styles.item}>{children}</li>;
}
