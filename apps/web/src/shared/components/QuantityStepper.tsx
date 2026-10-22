import { Minus, Plus } from 'lucide-react';
import styles from './QuantityStepper.module.css';

interface QuantityStepperProps {
  value: number;
  /** Giới hạn trên: min(99, tồn kho) theo cart BR-03 */
  max: number;
  onChange: (next: number) => void;
  /** Tên sản phẩm, để nhãn nút đọc được "Giảm số lượng {tên}" */
  itemName: string;
  disabled?: boolean;
}

/** [−] [số] [+] cao 40px (design-system §9.6). Tới biên thì nút tương ứng vô hiệu */
export function QuantityStepper({
  value,
  max,
  onChange,
  itemName,
  disabled,
}: QuantityStepperProps) {
  return (
    <div className={styles.stepper} role="group" aria-label={`Số lượng ${itemName}`}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        aria-label={`Giảm số lượng ${itemName}`}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Tăng số lượng ${itemName}`}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
