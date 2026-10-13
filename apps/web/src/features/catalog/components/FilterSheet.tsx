import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter } from 'lucide-react';
import { trapTabKey } from '../../../shared/lib/focusTrap';
import type { ProductCategory } from '../lib/productFilters';
import { CategoryFilter } from './CategoryFilter';
import styles from './FilterSheet.module.css';

interface FilterSheetProps {
  /** Loại đang áp dụng trên URL; là lựa chọn ban đầu trong bảng */
  category?: ProductCategory;
  /** Bấm "Áp dụng bộ lọc"; trang ghi lên URL rồi đóng bảng */
  onApply: (category: ProductCategory | undefined) => void;
  /** Bấm "Đóng" hoặc Esc; lựa chọn chưa áp dụng bị bỏ */
  onClose: () => void;
}

/**
 * Bảng lọc phủ toàn màn hình dưới 1280px (design-system §9.20). Trang chỉ render khi đang mở.
 * Lựa chọn trong bảng là tạm, chỉ gửi ra khi bấm "Áp dụng bộ lọc". Hộp thoại modal: giữ focus
 * trong bảng, khoá cuộn trang nền, đóng xong trả focus về phần tử đã mở bảng (nút "Lọc").
 */
export function FilterSheet({ category, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState(category);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Mở: nhớ phần tử đang focus, chuyển focus vào lựa chọn đang chọn; đóng: trả focus lại
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheetRef.current?.querySelector<HTMLElement>('input:checked')?.focus();
    return () => opener?.focus();
  }, []);

  // Khoá cuộn trang nền trong lúc bảng mở
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previous;
    };
  }, []);

  // Esc đóng bảng, bỏ lựa chọn tạm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={styles.sheet}
      onKeyDown={(e) => trapTabKey(e, sheetRef.current)}
    >
      <div className={styles.head}>
        <Filter size={20} className={styles.icon} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          Bộ lọc tìm kiếm
        </h2>
        <button type="button" className={styles.close} onClick={onClose}>
          Đóng
        </button>
      </div>
      <div className={`${styles.body} scroll-area`}>
        <CategoryFilter value={draft} onChange={setDraft} />
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.reset} onClick={() => setDraft(undefined)}>
          Bỏ chọn
        </button>
        <button type="button" className={styles.apply} onClick={() => onApply(draft)}>
          Áp dụng bộ lọc
        </button>
      </div>
    </div>,
    document.body,
  );
}
