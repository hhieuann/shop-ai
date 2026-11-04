import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  /** Có thì là link; mục cuối là trang hiện tại thì để trống */
  to?: string;
}

/**
 * Đường dẫn (design-system §9.22): "Trang chủ › Card đồ hoạ". Mục cuối là trang hiện tại,
 * không phải link, có aria-current="page", dài thì cắt một dòng với "…". Dấu › nằm trong mục
 * (aria-hidden) để danh sách chỉ có đúng số mục thật khi trình đọc màn hình đếm.
 *
 * `back` (trang chi tiết, pages/chi-tiet-san-pham.md §3.1): dưới 640px chỉ hiện một link
 * "‹ {label}", từ 640px hiện danh sách đủ; vẫn chỉ một `<nav>`.
 */
export function Breadcrumb({
  items,
  back,
}: {
  items: readonly BreadcrumbItem[];
  back?: { label: string; to: string };
}) {
  return (
    <nav aria-label="Đường dẫn" className={`${styles.nav} ${back ? styles.withBack : ''}`}>
      {back && (
        <Link to={back.to} className={styles.back}>
          <ChevronLeft size={16} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <ol className={styles.list}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${item.label}`} className={styles.item}>
              {i > 0 && <ChevronRight size={16} className={styles.separator} aria-hidden="true" />}
              {/* Mục có đường dẫn là link (kể cả khi chỉ có một mục, vd. trang 404 chỉ có "Trang chủ") */}
              {!item.to ? (
                <span className={styles.current} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
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
