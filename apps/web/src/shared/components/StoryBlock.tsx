import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './StoryBlock.module.css';

interface StoryBlockProps {
  title: string;
  subtitle?: string;
  /** Link "Xem tất cả" ở góc phải tiêu đề */
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
}

/** Khối nội dung chính của trang chủ: thẻ bo 16px, tiêu đề 20/28/600, nội dung tràn viền */
export function StoryBlock({ title, subtitle, action, children, className }: StoryBlockProps) {
  const titleId = useId();
  return (
    // Tên vùng lấy từ chính tiêu đề hiển thị (aria-labelledby), không đặt tên lần hai
    <section className={`${styles.block} ${className ?? ''}`} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action && (
          <Link className={styles.action} to={action.to}>
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
