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
  /**
   * 'readonly': ô chỉ xem (vd. Email ở trang tài khoản, pages/tai-khoan.md 3.1), luôn `readOnly`,
   * nền xám nhạt, viền nhạt, chữ mờ. Khác ô tạm khoá lúc đang gửi form (`readOnly` thường, giữ nền trắng)
   */
  appearance?: 'default' | 'readonly';
  /**
   * Có lỗi vẫn hiện gợi ý ngay dưới dòng lỗi (lỗi trước, gợi ý sau, cả hai nối vào ô bằng
   * aria-describedby), vd. ô Username ở trang tài khoản (pages/tai-khoan.md 3.1, mục 6).
   * Mặc định lỗi thay chỗ gợi ý
   */
  keepHint?: boolean;
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
  appearance = 'default',
  keepHint = false,
  ...input
}: FieldProps) {
  const readonlyLook = appearance === 'readonly';
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  // Gợi ý hiện thêm dưới dòng lỗi (keepHint)
  const extraHint = keepHint && error && hint ? hint : undefined;
  const hintId = `${id}-hint`;
  const describedBy = message ? (extraHint ? `${messageId} ${hintId}` : messageId) : undefined;
  const control = (
    <input
      id={id}
      className={`${styles.input} ${size === 'lg' ? styles.lg : ''} ${trailing ? styles.withTrailing : ''} ${readonlyLook ? styles.readonlyLook : ''}`}
      required={required}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...input}
      readOnly={readonlyLook || input.readOnly}
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
      {extraHint && (
        <p id={hintId} className={styles.hint}>
          {extraHint}
        </p>
      )}
    </div>
  );
}
