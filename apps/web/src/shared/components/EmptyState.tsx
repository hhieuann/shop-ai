import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** Icon lucide 48px `--fg-icon-soft`, chỉ để trang trí (`aria-hidden`) */
  icon?: LucideIcon;
  /**
   * Tiêu đề trong khối, giữa icon và câu (vd. trang 404). Có tiêu đề thì khối là
   * `<section aria-labelledby>` trỏ vào tiêu đề
   */
  title?: ReactNode;
  /** Cấp của tiêu đề: 1 khi khối là nội dung chính của trang (trang 404), mặc định 2 */
  titleLevel?: 1 | 2;
  /** Một câu giải thích */
  message: ReactNode;
  /** Link hoặc nút đi tiếp (vd. `<Link className={buttonClass(...)}>`); nhiều nút thì xếp một hàng */
  action?: ReactNode;
  /** Class thêm cho khối ngoài, vd. trang 404 đổi padding và khoảng cách nút */
  className?: string;
}

/** Khối trạng thái rỗng (design-system §9.12): khung bo 16px, nội dung căn giữa */
export function EmptyState({
  icon: Icon,
  title,
  titleLevel = 2,
  message,
  action,
  className,
}: EmptyStateProps) {
  const titleId = useId();
  const blockClass = `${styles.empty} ${className ?? ''}`.trim();
  const content = (
    <>
      {Icon && <Icon className={styles.icon} size={48} aria-hidden="true" />}
      {title &&
        (titleLevel === 1 ? (
          <h1 id={titleId} className={styles.title}>
            {title}
          </h1>
        ) : (
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        ))}
      <p className={`${styles.message} ${title ? styles.afterTitle : ''}`.trim()}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </>
  );
  // Không có tiêu đề thì giữ <div> như cũ (khối rỗng ở /orders, chi tiết đơn không đổi)
  return title ? (
    <section className={blockClass} aria-labelledby={titleId}>
      {content}
    </section>
  ) : (
    <div className={blockClass}>{content}</div>
  );
}
