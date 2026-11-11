import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeClosed } from 'lucide-react';
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

/**
 * Ô mật khẩu có nút hiện/ẩn trong ô (design-system §9.4). Icon theo trạng thái của mật khẩu: đang ẩn
 * là mắt nhắm, đang hiện là mắt mở; aria-label nói việc nút sẽ làm. Nút không nằm trong thứ tự Tab
 * (Tab từ ô đi thẳng tới nút gửi form), bấm nút không làm mất focus khỏi ô.
 */
export function PasswordField({ children, ...field }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.wrap}>
      <Field
        {...field}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            className={styles.toggle}
            tabIndex={-1}
            aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={visible}
            // Giữ focus ở ô nhập
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? (
              <Eye size={20} aria-hidden="true" />
            ) : (
              <EyeClosed size={20} aria-hidden="true" />
            )}
          </button>
        }
      />
      {children}
    </div>
  );
}
