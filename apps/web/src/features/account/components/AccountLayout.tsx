import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Breadcrumb, type BreadcrumbItem } from '../../../shared/components/Breadcrumb';
import { useRequireSignIn } from '../../../shared/auth/useRequireSignIn';
import { useAccount } from '../../../shared/auth/useSession';
import type { AccountOutletContext } from '../lib/accountOutlet';
import { currentSection } from '../lib/sections';
import { useSignOut } from '../lib/useSignOut';
import { AccountNav } from './AccountNav';
import { AccountSectionSheet } from './AccountSectionSheet';
import styles from './AccountLayout.module.css';

/**
 * Khung trang tài khoản (pages/tai-khoan.md mục 2, 5): đường dẫn, cột mục bên trái (≥1280) hoặc nút
 * "Đổi mục" + bảng chọn mục (<1280), nội dung là trang con. Bắt buộc đăng nhập.
 */
export function AccountLayout() {
  const session = useRequireSignIn();
  // Hồ sơ đọc riêng (useAccount): chờ có cả hồ sơ mới vẽ, để đầu cột trái không nháy tên trống
  const { status, user } = useAccount();
  const signedIn = session === 'signedIn' && status === 'signedIn';
  // Đã vẽ một lần thì giữ nội dung khi phiên vừa hết: khách tự đăng xuất thì useSignOut (ở đây hoặc ở
  // trang con) đang chuyển trang; hết hạn thì useRequireSignIn chuyển sang /login
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (signedIn) setShown(true);
  }, [signedIn]);
  const { pathname } = useLocation();
  const signOutAndLeave = useSignOut();
  const section = currentSection(pathname);

  const [sheetOpen, setSheetOpen] = useState(false);
  const switcherRef = useRef<HTMLButtonElement>(null);

  // Đổi mục (chọn trong bảng, hay Back) thì đóng bảng
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const closeSheet = useCallback((returnFocus: boolean) => {
    setSheetOpen(false);
    if (returnFocus) switcherRef.current?.focus();
  }, []);

  // Đăng xuất ở cột trái, bảng chọn mục: về trang chủ (useSignOut)
  const signOut = () => void signOutAndLeave();

  // Chưa biết phiên, chưa có hồ sơ, hoặc mở trang khi chưa đăng nhập (đang sang /login): chưa vẽ
  if (!signedIn && !shown) return null;

  const crumbs: BreadcrumbItem[] =
    section.id === 'info'
      ? [{ label: 'Trang chủ', to: '/' }, { label: 'Tài khoản' }]
      : [
          { label: 'Trang chủ', to: '/' },
          { label: 'Tài khoản', to: '/account' },
          { label: section.label },
        ];
  const SectionIcon = section.icon;

  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.grid}>
        <aside className={styles.aside}>
          <AccountNav user={user} current={section.id} onSignOut={signOut} />
        </aside>
        <div className={styles.content}>
          <button
            ref={switcherRef}
            type="button"
            className={styles.switcher}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            <SectionIcon size={20} className={styles.switcherIcon} aria-hidden="true" />
            <span className={styles.switcherLabel}>{section.label}</span>
            <span className={styles.switcherHint}>
              Đổi mục
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </button>
          <Outlet context={{ user } satisfies AccountOutletContext} />
        </div>
      </div>
      {sheetOpen && (
        <AccountSectionSheet current={section.id} onClose={closeSheet} onSignOut={signOut} />
      )}
    </div>
  );
}
