import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'primary' | 'accent' | 'neutral';

/**
 * Nhãn ngắn một dòng (design-system §9.7), cùng hình dạng với `StockBadge`.
 * Màu theo `tone`; chữ do nơi dùng truyền vào (vd. trạng thái đơn qua `OrderStatusBadge`).
 */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
