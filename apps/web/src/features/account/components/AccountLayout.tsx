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
  const leavingRef = useRef(false);
  const session = useRequireSignIn({ isLeaving: () => leavingRef.current });
  // Hồ sơ đọc riêng (useAccount): chờ có cả hồ sơ mới vẽ, để đầu cột trái không nháy tên trống
  const { status, user } = useAccount();
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

  const beginLeave = useCallback(() => {
    leavingRef.current = true;
  }, []);

  // Đăng xuất ở cột trái, bảng chọn mục: về trang chủ. Đánh dấu đang rời trang trước, để khung trang
  // không chuyển sang /login khi phiên vừa hết (useSignOut đăng xuất xong mới về /)
  const signOut = () => {
    beginLeave();
    void signOutAndLeave();
  };

  // Chưa biết phiên, hoặc vừa thành khách (đang chuyển sang /login): chưa vẽ nội dung.
  // Trang đang tự rời đi (beginLeave) thì vẫn vẽ để trang chuyển trang được.
  if ((session !== 'signedIn' || status !== 'signedIn') && !leavingRef.current) return null;

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
          <Outlet context={{ user, beginLeave } satisfies AccountOutletContext} />
        </div>
      </div>
      {sheetOpen && (
        <AccountSectionSheet current={section.id} onClose={closeSheet} onSignOut={signOut} />
      )}
    </div>
  );
}
