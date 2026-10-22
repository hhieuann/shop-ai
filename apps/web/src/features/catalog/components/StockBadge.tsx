import styles from './StockBadge.module.css';

/** Dưới mức này thì báo "Chỉ còn N" để khách biết nên mua sớm */
export const LOW_STOCK = 5;

/**
 * Nhãn tồn kho: còn hàng / chỉ còn N / hết hàng / ngừng bán.
 * `size="sm"` cho thẻ sản phẩm (design-system §9.9: 11/16/600, padding 1px 6px).
 */
export function StockBadge({
  stock,
  status,
  size = 'md',
}: {
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  size?: 'sm' | 'md';
}) {
  const cls = (tone: string) => `${styles.badge} ${styles[tone]} ${size === 'sm' ? styles.sm : ''}`;
  if (status !== 'ACTIVE') return <span className={cls('danger')}>Ngừng bán</span>;
  if (stock <= 0) return <span className={cls('danger')}>Hết hàng</span>;
  if (stock <= LOW_STOCK) return <span className={cls('warning')}>Chỉ còn {stock}</span>;
  return <span className={cls('success')}>Còn hàng</span>;
}
