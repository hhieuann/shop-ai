import styles from './StockBadge.module.css';

/** Dưới mức này thì báo "Chỉ còn N" để khách biết nên mua sớm */
export const LOW_STOCK = 5;

/** Nhãn tồn kho: còn hàng / chỉ còn N / hết hàng / ngừng bán */
export function StockBadge({ stock, status }: { stock: number; status: 'ACTIVE' | 'INACTIVE' }) {
  if (status !== 'ACTIVE')
    return <span className={`${styles.badge} ${styles.danger}`}>Ngừng bán</span>;
  if (stock <= 0) return <span className={`${styles.badge} ${styles.danger}`}>Hết hàng</span>;
  if (stock <= LOW_STOCK)
    return <span className={`${styles.badge} ${styles.warning}`}>Chỉ còn {stock}</span>;
  return <span className={`${styles.badge} ${styles.success}`}>Còn hàng</span>;
}
