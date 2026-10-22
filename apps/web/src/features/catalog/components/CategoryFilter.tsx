import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Radio } from '../../../shared/components/Radio';
import { CATEGORIES, type ProductCategory } from '../lib/productFilters';
import styles from './CategoryFilter.module.css';

interface CategoryFilterProps {
  /** Loại đang chọn; không có là "Tất cả loại" */
  value?: ProductCategory;
  onChange: (value: ProductCategory | undefined) => void;
}

/**
 * Nhóm lọc "Loại hàng" (design-system §9.20): đầu nhóm là nút thu gọn, thân là
 * "Tất cả loại" + 13 loại. Dùng chung cho cột lọc trên máy tính và bảng lọc trên điện thoại;
 * mỗi chỗ có tên nhóm radio riêng nên hai nhóm không dính nhau.
 */
export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const bodyId = `${id}-body`;
  const name = `${id}-category`;

  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        Loại hàng
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>
      <div id={bodyId} className={styles.body} hidden={!open}>
        <fieldset className={styles.fieldset}>
          <legend className="sr-only">Loại hàng</legend>
          <Radio name={name} value="" checked={!value} onChange={() => onChange(undefined)}>
            Tất cả loại
          </Radio>
          {CATEGORIES.map((c) => (
            <Radio
              key={c.value}
              name={name}
              value={c.value}
              checked={value === c.value}
              onChange={() => onChange(c.value)}
            >
              {c.label}
            </Radio>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
