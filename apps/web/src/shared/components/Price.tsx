import { formatVnd, spokenVnd } from '../lib/format';
import styles from './Price.module.css';

/** Giá VND: số đậm, ₫ nhỏ hơn, không tô đỏ. Trình đọc màn hình nghe "… đồng". */
export function Price({ amount, size = 'md' }: { amount: number; size?: 'md' | 'lg' }) {
  const [number] = formatVnd(amount).split('₫');
  return (
    <span className={`${styles.price} ${size === 'lg' ? styles.lg : ''}`}>
      <span aria-hidden="true">
        <span className={styles.number}>{number}</span>
        <span className={styles.sign}>₫</span>
      </span>
      <span className="sr-only">{spokenVnd(amount)}</span>
    </span>
  );
}
