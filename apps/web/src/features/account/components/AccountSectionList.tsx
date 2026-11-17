import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { ACCOUNT_SECTIONS, type AccountSection } from '../lib/sections';
import styles from './AccountSectionList.module.css';

interface AccountSectionListProps {
  current: AccountSection['id'];
  /** 'nav': cột trái (mục 44px, chữ 14/20); 'sheet': bảng chọn mục (mục 48px, chữ 16/24) */
  size: 'nav' | 'sheet';
  onSignOut: () => void;
  /** Bấm một mục (bảng chọn mục đóng trước khi chuyển trang) */
  onNavigate?: () => void;
}

/** Danh sách mục + "Đăng xuất" (design-system §9.27), dùng ở AccountNav và AccountSectionSheet */
export function AccountSectionList({
  current,
  size,
  onSignOut,
  onNavigate,
}: AccountSectionListProps) {
  return (
    <ul className={`${styles.list} ${size === 'sheet' ? styles.sheet : ''}`}>
      {ACCOUNT_SECTIONS.map(({ id, label, icon: Icon, to }) => (
        <li key={id}>
          <Link
            to={to}
            className={styles.item}
            aria-current={id === current ? 'page' : undefined}
            onClick={onNavigate}
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </Link>
        </li>
      ))}
      {/* Đường kẻ trước "Đăng xuất" */}
      <li className={styles.divider} aria-hidden="true" />
      <li>
        <button type="button" className={`${styles.item} ${styles.signOut}`} onClick={onSignOut}>
          <LogOut size={20} aria-hidden="true" />
          Đăng xuất
        </button>
      </li>
    </ul>
  );
}
