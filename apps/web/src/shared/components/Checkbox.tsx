import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import { Check, Minus } from 'lucide-react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Chọn một phần (ô "Chọn tất cả" khi chỉ tick vài món). Chỉ đặt được bằng JS */
  indeterminate?: boolean;
}

/** Ô tick 20×20 (design-system §9.5): ô gốc của trình duyệt ẩn đi, vẽ lại bằng span + icon */
export function Checkbox({ indeterminate = false, className, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={`${styles.box} ${className ?? ''}`}>
      <input ref={ref} type="checkbox" className={styles.input} {...props} />
      <span className={styles.mark} aria-hidden="true">
        {indeterminate ? <Minus size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
      </span>
    </span>
  );
}
