import { formatVnd, spokenVnd } from '../lib/format';
import styles from './Price.module.css';

/**
 * Giá VND (design-system §9.8): số đậm, ₫ nhỏ hơn, không tô đỏ. Trình đọc màn hình nghe "… đồng".
 * Cỡ: md (thẻ, giỏ), lg (trang chi tiết, tổng tiền), title (thẻ trang danh sách).
 */
export function Price({ amount, size = 'md' }: { amount: number; size?: 'md' | 'lg' | 'title' }) {
  const [number] = formatVnd(amount).split('₫');
  return (
    <span className={`${styles.price} ${size === 'md' ? '' : styles[size]}`}>
      <span aria-hidden="true">
        <span className={styles.number}>{number}</span>
        <span className={styles.sign}>₫</span>
      </span>
      <span className="sr-only">{spokenVnd(amount)}</span>
    </span>
  );
}
