import { forwardRef, type ReactNode } from 'react';
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import styles from './Alert.module.css';

type AlertTone = 'success' | 'warning' | 'danger';

const ICON = { success: CircleCheck, warning: TriangleAlert, danger: CircleX } as const;

/**
 * Thông báo có viền trái theo màu trạng thái (design-system §9.13).
 * success dùng role="status" (đọc nhẹ), warning/danger dùng role="alert".
 * Có tabIndex -1 để trang chuyển focus tới khi thông báo vừa hiện.
 */
export const Alert = forwardRef<HTMLDivElement, { tone: AlertTone; children: ReactNode }>(
  function Alert({ tone, children }, ref) {
    const Icon = ICON[tone];
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role={tone === 'success' ? 'status' : 'alert'}
        className={`${styles.alert} ${styles[tone]}`}
      >
        <Icon size={20} className={styles.icon} aria-hidden="true" />
        <div className={styles.body}>{children}</div>
      </div>
    );
  },
);
