import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './Field.module.css';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  hint?: string;
  /** 48px cho form đặt hàng, đăng nhập; 40px cho chỗ khác */
  size?: 'md' | 'lg';
  className?: string;
  /**
   * Nút đặt trong ô, sát mép phải và căn giữa theo chiều cao ô (vd. nút hiện mật khẩu,
   * design-system §9.4 "Nút trong ô"). Có thì ô được bọc trong một khung riêng và chừa chỗ bên phải
   */
  trailing?: ReactNode;
}

/** Nhãn + ô nhập + dòng lỗi/gợi ý (design-system §9.4) */
export function Field({
  label,
  error,
  hint,
  size = 'md',
  required,
  className,
  trailing,
  ...input
}: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  const control = (
    <input
      id={id}
      className={`${styles.input} ${size === 'lg' ? styles.lg : ''} ${trailing ? styles.withTrailing : ''}`}
      required={required}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={message ? messageId : undefined}
      {...input}
    />
  );
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
      {trailing ? (
        // Khung chỉ bọc ô (không bọc nhãn, lỗi, gợi ý) để nút căn theo chiều cao ô
        <div className={styles.control}>
          {control}
          {trailing}
        </div>
      ) : (
        control
      )}
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {error && <CircleAlert size={16} aria-hidden="true" />}
          {message}
        </p>
      )}
    </div>
  );
}
