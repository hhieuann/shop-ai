import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Radio.module.css';

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  /** Nhãn hiện bên phải vòng tròn; cả dòng là vùng bấm */
  children: ReactNode;
}

/**
 * Ô chọn một trong nhóm (design-system §9.5): tròn 20px, chọn thì chấm chàm.
 * Input radio thật nằm trong label, chỉ ẩn bằng sr-only, nên Tab, Space, mũi tên lên/xuống
 * và trình đọc màn hình chạy như radio gốc. Các radio cùng nhóm dùng chung `name`.
 */
export function Radio({ children, className, ...props }: RadioProps) {
  return (
    <label className={`${styles.row} ${props.disabled ? styles.disabled : ''} ${className ?? ''}`}>
      <input type="radio" className={`sr-only ${styles.input}`} {...props} />
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.label}>{children}</span>
    </label>
  );
}
