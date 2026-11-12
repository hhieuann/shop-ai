import { Circle, CircleCheck } from 'lucide-react';
import { PASSWORD_RULES } from '../lib/validation';
import styles from './AuthCard.module.css';

interface PasswordRulesProps {
  /** Ô mật khẩu nối tới danh sách bằng aria-describedby, nên id phải duy nhất trong trang */
  id: string;
  password: string;
}

/**
 * Danh sách điều kiện mật khẩu dưới ô (dang-nhap.md §3.2), dùng chung cho tạo tài khoản và đặt lại
 * mật khẩu (§3.4). Cập nhật khi gõ; điều kiện đạt đổi icon và màu, kèm chữ ẩn cho trình đọc màn hình.
 */
export function PasswordRules({ id, password }: PasswordRulesProps) {
  return (
    <ul id={id} className={styles.rules}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={met ? styles.met : undefined}>
            {met ? (
              <CircleCheck size={16} aria-hidden="true" />
            ) : (
              <Circle size={16} aria-hidden="true" />
            )}
            {rule.label}
            <span className="sr-only">{met ? ' (đã đạt)' : ' (chưa đạt)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
