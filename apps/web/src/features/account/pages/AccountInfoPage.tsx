import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Field } from '../../../shared/components/Field';
import { buttonClass } from '../../../shared/components/buttonClass';
import { AccountPanel } from '../components/AccountPanel';
import { useAccountOutlet } from '../lib/accountOutlet';
import styles from './AccountInfoPage.module.css';

/**
 * Thông tin tài khoản `/account` (pages/tai-khoan.md 3.1). Ở bản này Username và Email đều chỉ xem;
 * sửa username và nút "Cập nhật" làm ở story đổi username (tai-khoan.md mục 9).
 */
export function AccountInfoPage() {
  const { user } = useAccountOutlet();

  return (
    <AccountPanel
      title="Thông tin tài khoản"
      subtitle="Username là tên hiện trên header. Email dùng để đăng nhập."
    >
      <div className={styles.fields}>
        <Field
          label="Username"
          size="lg"
          appearance="readonly"
          autoComplete="nickname"
          value={user?.username ?? ''}
        />
        <Field
          label="Email"
          size="lg"
          type="email"
          appearance="readonly"
          autoComplete="email"
          value={user?.email ?? ''}
        />
      </div>

      <div className={styles.password}>
        <div>
          <h2 className={styles.passwordTitle}>Mật khẩu</h2>
          <p className={styles.passwordText}>Nên đổi khi nghi người khác biết mật khẩu của bạn.</p>
        </div>
        <Link
          to="/account/password"
          className={`${buttonClass({ variant: 'secondary', size: 'md' })} ${styles.passwordLink}`}
        >
          <KeyRound size={18} aria-hidden="true" />
          Đổi mật khẩu
        </Link>
      </div>
    </AccountPanel>
  );
}
