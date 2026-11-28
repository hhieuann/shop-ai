import { useId, type SelectHTMLAttributes } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'> {
  label: string;
  options: readonly SelectOption[];
  error?: string;
  hint?: string;
  /** 40px mặc định; 48px cho form lớn, như `Field` */
  size?: 'md' | 'lg';
  /**
   * Ẩn nhãn khỏi mắt nhưng trình đọc màn hình vẫn đọc (thanh công cụ trang admin, nơi ô đứng cạnh
   * ô tìm kiếm và đã rõ nghĩa). Form thì luôn hiện nhãn
   */
  hideLabel?: boolean;
  className?: string;
}

/**
 * Ô chọn dùng `<select>` gốc (design-system §9.30): cùng hình dạng, nhãn, lỗi, gợi ý như `Field`
 * (§9.4); mũi tên mặc định của trình duyệt. Dùng `<select>` gốc để có sẵn bàn phím, trình đọc màn
 * hình và bảng chọn của điện thoại.
 */
export function Select({
  label,
  options,
  error,
  hint,
  size = 'md',
  hideLabel = false,
  required,
  className,
  ...select
}: SelectProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <select
        id={id}
        className={`${styles.select} ${size === 'lg' ? styles.lg : ''}`}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {error && <CircleAlert size={16} aria-hidden="true" />}
          {message}
        </p>
      )}
    </div>
  );
}
