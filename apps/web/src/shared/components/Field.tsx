import { useId, type InputHTMLAttributes } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './Field.module.css';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  hint?: string;
  /** 48px cho form đặt hàng, đăng nhập; 40px cho chỗ khác */
  size?: 'md' | 'lg';
  className?: string;
}

/** Nhãn + ô nhập + dòng lỗi/gợi ý (design-system §9.4) */
export function Field({
  label,
  error,
  hint,
  size = 'md',
  required,
  className,
  ...input
}: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <input
        id={id}
        className={`${styles.input} ${size === 'lg' ? styles.lg : ''}`}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...input}
      />
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {error && <CircleAlert size={16} aria-hidden="true" />}
          {message}
        </p>
      )}
    </div>
  );
}
