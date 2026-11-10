import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** Icon lucide 48px `--fg-icon-soft`, chỉ để trang trí (`aria-hidden`) */
  icon?: LucideIcon;
  /** Một câu giải thích */
  message: ReactNode;
  /** Một link hoặc nút đi tiếp (vd. `<Link className={buttonClass(...)}>`) */
  action?: ReactNode;
}

/** Khối trạng thái rỗng (design-system §9.12): khung bo 16px, nội dung căn giữa */
export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {Icon && <Icon className={styles.icon} size={48} aria-hidden="true" />}
      <p className={styles.message}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
