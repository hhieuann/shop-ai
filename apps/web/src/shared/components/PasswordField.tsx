import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from './Field';
import styles from './PasswordField.module.css';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label: string;
  error?: string;
  hint?: string;
  size?: 'md' | 'lg';
  /** Nội dung dưới ô, vd. danh sách điều kiện mật khẩu */
  children?: ReactNode;
}

/** Ô mật khẩu có nút hiện/ẩn bên trong (design-system §9.4). Bấm nút không làm mất focus khỏi ô. */
export function PasswordField({ children, ...field }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.wrap}>
      <Field {...field} type={visible ? 'text' : 'password'} className={styles.field} />
      <button
        type="button"
        className={`${styles.toggle} ${field.size === 'lg' ? styles.lg : ''}`}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        // Giữ focus ở ô nhập
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
      {children}
    </div>
  );
}
