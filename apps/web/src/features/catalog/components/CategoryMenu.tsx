import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../lib/productFilters';
import { useActiveCategory } from '../hooks/useActiveCategory';
import { CategoryIcon } from './CategoryIcon';
import styles from './CategoryMenu.module.css';

/**
 * Danh sách 13 loại hàng (design-system §9.18). Dùng ở cột trái trang chủ, bảng thả xuống
 * của nút "Danh mục" và ngăn kéo trên điện thoại.
 * `framed=false` bỏ khung (trong ngăn kéo đã có nền trắng).
 */
export function CategoryMenu({
  framed = true,
  onNavigate,
  className = '',
}: {
  framed?: boolean;
  /** Gọi khi bấm một mục, kể cả mục đang xem (URL không đổi nên bảng không tự đóng) */
  onNavigate?: () => void;
  className?: string;
}) {
  const active = useActiveCategory();
  return (
    <nav
      aria-label="Danh mục"
      className={`${styles.menu} ${framed ? styles.framed : ''} ${className}`}
    >
      <ul className={styles.list}>
        {CATEGORIES.map((c) => (
          <li key={c.value}>
            <Link
              to={`/products?category=${c.value}`}
              className={styles.item}
              aria-current={active === c.value ? 'page' : undefined}
              onClick={onNavigate}
            >
              <span className={styles.tile} aria-hidden="true">
                <CategoryIcon category={c.value} size={20} />
              </span>
              <span className={styles.label}>{c.label}</span>
              <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
