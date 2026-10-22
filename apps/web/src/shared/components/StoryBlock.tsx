import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './StoryBlock.module.css';

interface StoryBlockProps {
  title: string;
  /** Link "Xem tất cả" ở mép phải hàng tiêu đề */
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
}

/**
 * Khối sản phẩm (design-system §9.10): không khung, tiêu đề 24/32/700 nằm thẳng trên nền trang,
 * link "Xem tất cả" màu chàm ở mép phải, hàng thẻ cách tiêu đề 16px.
 */
export function StoryBlock({ title, action, children, className }: StoryBlockProps) {
  const titleId = useId();
  return (
    // Tên vùng lấy từ chính tiêu đề hiển thị (aria-labelledby), không đặt tên lần hai
    <section className={`${styles.block} ${className ?? ''}`} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {action && (
          <Link className={styles.action} to={action.to}>
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
