import { useEffect, useRef, type ReactNode } from 'react';
import { Alert } from '../../../shared/components/Alert';
import styles from './AuthCard.module.css';

interface AuthCardProps {
  title: string;
  subtitle: ReactNode;
  /** Lỗi chung đầu form (dang-nhap.md §4); hiện thì focus vào */
  alert?: string | null;
  /** Thông báo thành công (vd. "Đã gửi mã mới.") */
  notice?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}

/** Thẻ form hẹp ở giữa trang cho đăng nhập, tạo tài khoản, nhập mã (dang-nhap.md §2) */
export function AuthCard({ title, subtitle, alert, notice, children, footer }: AuthCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Đổi bước (đổi tiêu đề): focus vào <h1> mới để trình đọc màn hình đọc lại (§6)
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);
  useEffect(() => {
    if (alert) alertRef.current?.focus();
  }, [alert]);

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        <h1 id="auth-title" ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {alert && (
          <Alert tone="danger" ref={alertRef}>
            {alert}
          </Alert>
        )}
        {notice && <Alert tone="success">{notice}</Alert>}
        <div className={styles.body}>{children}</div>
        {footer && <p className={styles.footer}>{footer}</p>}
      </section>
    </div>
  );
}
