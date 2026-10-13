import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  /** Có thì là link; mục cuối (trang hiện tại) để trống */
  to?: string;
}

/**
 * Đường dẫn (design-system §9.22): "Trang chủ › Card đồ hoạ". Mục cuối là trang hiện tại,
 * không phải link, có aria-current="page". Dấu › nằm trong mục (aria-hidden) để danh sách
 * chỉ có đúng số mục thật khi trình đọc màn hình đếm.
 */
export function Breadcrumb({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label="Đường dẫn" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${item.label}`} className={styles.item}>
              {i > 0 && <ChevronRight size={16} className={styles.separator} aria-hidden="true" />}
              {last || !item.to ? (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              ) : (
                <Link to={item.to} className={styles.link}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
