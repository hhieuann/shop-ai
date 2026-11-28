import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Package, Receipt, Store, type LucideIcon } from 'lucide-react';
import markUrl from '../assets/logo-mark.webp';
import { useTwoFactorStatus } from '../features/account/lib/useTwoFactorStatus';
import { AdminForbidden } from '../features/admin/components/AdminForbidden';
import { useRequireSignIn } from '../shared/auth/useRequireSignIn';
import { useAccount } from '../shared/auth/useSession';
import { AccountMenu } from './AccountMenu';
import styles from './AdminLayout.module.css';

interface AdminSection {
  to: string;
  label: string;
  icon: LucideIcon;
  /** false: trang chưa có, chưa hiện mục */
  ready: boolean;
}

/** Nhóm mục của cột trái (design-system §9.29). Không số đếm: API admin không trả tổng số */
const GROUPS: { label: string; items: AdminSection[] }[] = [
  {
    label: 'Bán hàng',
    items: [{ to: '/admin', label: 'Đơn hàng', icon: Receipt, ready: true }],
  },
  {
    label: 'Danh mục',
    items: [{ to: '/admin/products', label: 'Sản phẩm', icon: Package, ready: true }],
  },
];

/**
 * Khung trang quản trị (design-system §9.29, pages/admin-don-hang.md mục 1): thay header, hàng danh
 * mục và footer của cửa hàng. Thanh trên 56px (logo, nhãn "Quản trị", Về cửa hàng, menu tài khoản);
 * từ 960px cột trái 232px, dưới 960px hàng chip dính dưới thanh trên.
 *
 * Kiểm quyền cho mọi trang `/admin/*`: chưa đăng nhập thì sang /login, không phải admin thì báo không
 * có quyền (không gọi API admin), admin chưa bật xác thực hai lớp thì sang trang bật (account.md
 * BR-10). Chỉ chặn ở web: API tự kiểm nhóm admin (403); bảo vệ thật là MFA trên Cognito (threat model L5).
 */
export function AdminLayout() {
  const session = useRequireSignIn();
  const account = useAccount();
  const { pathname, search } = useLocation();
  const isAdmin =
    session === 'signedIn' && account.status === 'signedIn' && Boolean(account.user?.isAdmin);
  const twoFactor = useTwoFactorStatus(isAdmin ? account.user?.email : undefined);

  let content;
  // Chưa biết phiên (khách sẽ được chuyển sang /login) hoặc chưa đọc xong hồ sơ
  if (session !== 'signedIn' || account.status === 'loading') {
    content = <p className={styles.message}>Đang tải…</p>;
  } else if (!isAdmin) {
    // Nhóm admin đọc từ token; đọc hồ sơ lỗi hoặc không phải admin thì không gọi API admin
    content = <AdminForbidden />;
  } else if (twoFactor.isPending) {
    content = <p className={styles.message}>Đang tải…</p>;
  } else if (twoFactor.data === false) {
    // Chưa bật thì sang trang bật, bật xong quay lại đúng trang; đọc trạng thái lỗi thì vẫn hiện trang
    return (
      <Navigate
        to="/account/two-factor"
        replace
        state={{ from: `${pathname}${search}`, reason: 'admin' }}
      />
    );
  } else {
    content = <Outlet />;
  }

  const sections = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.ready) })).filter(
    (g) => g.items.length > 0,
  );
  const navReady = isAdmin && twoFactor.data !== false && !twoFactor.isPending;

  return (
    <div className={`${styles.shell} ${navReady ? styles.withNav : ''}`}>
      <header className={styles.topbar}>
        <Link to="/admin" className={styles.brand} aria-label="Black Magic, trang quản trị">
          <img
            className={styles.mark}
            src={markUrl}
            alt=""
            width={115}
            height={112}
            decoding="async"
          />
          <span className={styles.wordmark} aria-hidden="true">
            Black Magic
          </span>
          <span className={styles.chip} aria-hidden="true">
            Quản trị
          </span>
        </Link>
        <div className={styles.end}>
          <Link to="/" className={styles.store}>
            <Store size={20} aria-hidden="true" />
            <span className={styles.storeLabel}>Về cửa hàng</span>
          </Link>
          <AccountMenu />
        </div>
      </header>

      {navReady && (
        <nav aria-label="Quản trị" className={styles.nav}>
          {sections.map((group) => (
            <div key={group.label} className={styles.group}>
              <p className={styles.groupLabel}>{group.label}</p>
              <ul className={styles.list}>
                {group.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    {/* end: /admin chỉ là mục hiện tại khi đúng trang đơn hàng */}
                    <NavLink to={to} end={to === '/admin'} className={styles.item}>
                      <Icon size={20} aria-hidden="true" className={styles.icon} />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}

      <main id="main" className={styles.main}>
        {content}
      </main>
    </div>
  );
}
