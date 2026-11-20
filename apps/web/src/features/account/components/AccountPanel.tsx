import { useId, type ReactNode } from 'react';
import styles from './AccountPanel.module.css';

interface AccountPanelProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

/** Khối nội dung một mục tài khoản (pages/tai-khoan.md mục 2): `<section aria-labelledby>` trỏ vào `<h1>` */
export function AccountPanel({ title, subtitle, children }: AccountPanelProps) {
  const titleId = useId();
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h1 id={titleId} className={styles.title}>
        {title}
      </h1>
      <p className={styles.subtitle}>{subtitle}</p>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
