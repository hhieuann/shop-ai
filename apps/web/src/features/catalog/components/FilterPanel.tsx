import { Filter } from 'lucide-react';
import type { ProductCategory } from '../lib/productFilters';
import { CategoryFilter } from './CategoryFilter';
import styles from './FilterPanel.module.css';

interface FilterPanelProps {
  category?: ProductCategory;
  /** Chọn là áp dụng ngay (không có nút "Áp dụng" trên máy tính) */
  onCategoryChange: (category: ProductCategory | undefined) => void;
}

/**
 * Cột lọc bên trái trang danh sách trên máy tính (design-system §9.20): dính khi cuộn,
 * thân cuộn bên trong. Bản chốt chỉ có nhóm "Loại hàng" (catalog BR-02).
 */
export function FilterPanel({ category, onCategoryChange }: FilterPanelProps) {
  return (
    <aside aria-label="Bộ lọc" className={styles.panel}>
      <div className={styles.head}>
        <Filter size={20} className={styles.icon} aria-hidden="true" />
        <h2 className={styles.title}>Bộ lọc tìm kiếm</h2>
      </div>
      <div className={`${styles.body} scroll-area`}>
        <CategoryFilter value={category} onChange={onCategoryChange} />
      </div>
    </aside>
  );
}
