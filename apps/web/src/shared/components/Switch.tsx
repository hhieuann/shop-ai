import { useId } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  /** Chữ bên trái công tắc, cũng là tên đọc của nút, vd. "Đang bán" */
  label: string;
  /** Một dòng giải thích dưới nhãn, nối vào nút bằng aria-describedby */
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Công tắc bật, tắt (design-system §9.31): `<button role="switch" aria-checked>`. Bấm, Space, Enter
 * đều đổi trạng thái. Đổi ngay khi bấm, không cần nút lưu riêng cho công tắc; trang tự lo việc lưu.
 */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  return (
    <div className={`${styles.row} ${className ?? ''}`}>
      <div className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description && (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        className={styles.track}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} aria-hidden="true" />
      </button>
    </div>
  );
}
