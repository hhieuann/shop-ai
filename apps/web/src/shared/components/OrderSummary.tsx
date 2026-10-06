import { useId, type ReactNode } from 'react';
import { Price } from './Price';
import styles from './OrderSummary.module.css';

export interface SummaryRow {
  label: string;
  value: ReactNode;
}

interface OrderSummaryProps {
  title: string;
  rows: readonly SummaryRow[];
  total: number;
  /** Nút chính, thông báo, chú thích dưới dòng tổng */
  children?: ReactNode;
  className?: string;
}

/**
 * Khối tóm tắt tiền ở cột phải (design-system §9.15), dùng cho giỏ hàng và đặt hàng.
 * Tổng tiền nằm trong vùng aria-live để trình đọc màn hình nghe được khi tick/bỏ tick.
 */
export function OrderSummary({ title, rows, total, children, className }: OrderSummaryProps) {
  const titleId = useId();
  return (
    <section className={`${styles.summary} ${className ?? ''}`} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {rows.length > 0 && (
        <dl className={styles.rows}>
          {rows.map((row) => (
            <div key={row.label} className={styles.row}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div
        className={`${styles.total} ${rows.length > 0 ? styles.divided : ''}`}
        aria-live="polite"
      >
        <span className={styles.totalLabel}>Tổng cộng</span>
        <Price amount={total} />
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </section>
  );
}

/** Giá trị "Miễn phí" của dòng phí vận chuyển (ordering BR-06) */
export function FreeShipping() {
  return <span className={styles.free}>Miễn phí</span>;
}
