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
interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
  /** Nút đi kèm (vd. "Gộp vào giỏ"): máy tính nằm sát mép phải, điện thoại xuống dòng thẳng lề chữ */
  action?: ReactNode;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { tone, children, action },
  ref,
) {
  const Icon = ICON[tone];
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={tone === 'success' ? 'status' : 'alert'}
      className={`${styles.alert} ${styles[tone]} ${action ? styles.withAction : ''}`}
    >
      <Icon size={20} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
});
