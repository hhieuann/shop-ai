import type { UserProfile } from '../../../shared/auth/token';
import type { AccountSection } from '../lib/sections';
import { AccountSectionList } from './AccountSectionList';
import styles from './AccountNav.module.css';

interface AccountNavProps {
  user: UserProfile | null;
  current: AccountSection['id'];
  onSignOut: () => void;
}

/** Cột mục tài khoản (≥1280, design-system §9.27): đầu khối avatar chữ cái, username, email; danh sách mục */
export function AccountNav({ user, current, onSignOut }: AccountNavProps) {
  const username = user?.username ?? '';
  return (
    <div className={styles.nav}>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {username.charAt(0).toUpperCase()}
        </span>
        <div className={styles.who}>
          <p className={styles.username}>{username}</p>
          {user?.email && <p className={styles.email}>{user.email}</p>}
        </div>
      </div>
      <nav aria-label="Tài khoản">
        <AccountSectionList current={current} size="nav" onSignOut={onSignOut} />
      </nav>
    </div>
  );
}
