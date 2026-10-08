import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
  Sparkles,
  User,
  UserRound,
  X,
} from 'lucide-react';
import { queryKeys } from '../shared/api/queryKeys';
import { signOut } from '../shared/auth/token';
import { clearCartSession } from '../features/cart/lib/afterSignIn';
import { clearCheckoutItems } from '../features/orders/lib/checkoutStorage';
import { useAccount } from '../shared/auth/useSession';
import styles from './AccountMenu.module.css';

/** Trang bắt buộc đăng nhập: đăng xuất ở đây thì về trang chủ (design-system §9.17) */
const SIGNED_IN_ONLY = ['/orders', '/checkout', '/admin'];
const isSignedInOnly = (path: string) =>
  SIGNED_IN_ONLY.some((p) => path === p || path.startsWith(`${p}/`));

const DESKTOP = '(min-width: 960px)';

/**
 * Nút tài khoản trên header và bảng thả xuống (docs/web/design-system.md §9.17).
 * Chưa đăng nhập: "Đăng nhập" → bảng lợi ích + nút Đăng nhập / Tạo tài khoản.
 * Đã đăng nhập: username → bảng chào + Trang quản trị (admin) + Đăng xuất.
 */
export function AccountMenu() {
  const { status, user } = useAccount();
  const signedIn = status === 'signedIn';
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const titleId = useId();

  const username = user?.username ?? '';
  const label = signedIn ? username || 'Tài khoản' : 'Đăng nhập';
  const ariaLabel = signedIn ? (username ? `Tài khoản của ${username}` : 'Tài khoản') : 'Đăng nhập';
  const from = `${location.pathname}${location.search}`;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Đổi trang (bấm link trong bảng hay trên header) thì đóng
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // Mở: khoá cuộn trang, focus vào phần tử bấm được đầu tiên, Esc để đóng
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Dưới 960px bảng rộng hết màn hình, nằm ngay dưới hàng nút: đo vị trí nút để đặt bảng và mũi nhọn
  const [mobilePos, setMobilePos] = useState<{ top: number; arrowX: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button || window.matchMedia(DESKTOP).matches) return setMobilePos(null);
      const rect = button.getBoundingClientRect();
      setMobilePos({ top: rect.bottom + 12, arrowX: rect.left + rect.width / 2 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  // Tên dài hơn ô "Đăng nhập": mờ dần phần cuối, chỉ bật khi thật sự tràn
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [label]);

  // Tab ra khỏi nút và bảng thì đóng (không đưa focus về nút)
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (open && next && !rootRef.current?.contains(next)) setOpen(false);
  };

  const doSignOut = async () => {
    await signOut();
    // Đăng xuất là hết phiên trên trình duyệt này: giỏ khách rỗng, không để lại giỏ và đơn của
    // người vừa dùng (account.md BR-09). Danh sách sản phẩm vẫn giữ trong bộ nhớ đệm.
    clearCartSession(queryClient);
    clearCheckoutItems();
    queryClient.removeQueries({ queryKey: queryKeys.orders.all });
    close(true);
    if (isSignedInOnly(location.pathname)) navigate('/', { replace: true });
  };

  const panelStyle = mobilePos ? { top: mobilePos.top } : undefined;
  const arrowStyle = mobilePos ? { top: mobilePos.top - 7, left: mobilePos.arrowX - 7 } : undefined;

  return (
    <div className={styles.root} ref={rootRef} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <User size={28} aria-hidden="true" />
        {/* Ô chữ rộng đúng bằng chữ "Đăng nhập": chữ ẩn giữ chỗ, tên thật chồng lên cùng ô */}
        <span className={styles.label} aria-hidden="true">
          <span className={styles.sizer}>Đăng nhập</span>
          <span ref={nameRef} className={`${styles.name} ${overflowing ? styles.fade : ''}`}>
            {label}
          </span>
        </span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>

      {/* Vùng tối phủ mọi thứ dưới header (header z-index 210 nằm trên) */}
      {createPortal(
        <div
          className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`}
          onClick={() => close(true)}
          aria-hidden="true"
        />,
        document.body,
      )}

      {open && (
        <>
          <span className={styles.arrow} style={arrowStyle} aria-hidden="true" />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className={styles.panel}
            style={panelStyle}
          >
            {signedIn ? (
              <>
                <div className={styles.greeting}>
                  <UserRound size={28} className={styles.headIcon} aria-hidden="true" />
                  <div className={styles.who}>
                    <p id={titleId} className={styles.hello}>
                      Xin chào,
                    </p>
                    <p className={styles.username}>{username || 'bạn'}</p>
                    {user?.email && <p className={styles.email}>{user.email}</p>}
                  </div>
                </div>
                <ul className={styles.items}>
                  {user?.isAdmin && (
                    <li className={styles.adminItem}>
                      <Link to="/admin" className={styles.item} data-autofocus>
                        <LayoutDashboard size={24} aria-hidden="true" />
                        Trang quản trị
                      </Link>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() => void doSignOut()}
                      data-autofocus={user?.isAdmin ? undefined : true}
                    >
                      <LogOut size={24} aria-hidden="true" />
                      Đăng xuất
                    </button>
                  </li>
                </ul>
              </>
            ) : (
              <>
                <div className={styles.head}>
                  <UserRound size={28} className={styles.headIcon} aria-hidden="true" />
                  <h2 id={titleId} className={styles.title}>
                    Đăng nhập để mua sắm dễ hơn
                  </h2>
                </div>
                <ul className={styles.benefits}>
                  <li>
                    <ShoppingCart size={20} aria-hidden="true" />
                    Giỏ hàng lưu theo tài khoản
                  </li>
                  <li>
                    <Package size={20} aria-hidden="true" />
                    Theo dõi đơn hàng
                  </li>
                  <li>
                    <Sparkles size={20} aria-hidden="true" />
                    Gợi ý sản phẩm dành riêng cho bạn
                  </li>
                </ul>
                <div className={styles.buttons}>
                  <Link
                    to="/login"
                    state={{ from }}
                    className={`${styles.button} ${styles.primary}`}
                    data-autofocus
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    state={{ from }}
                    className={`${styles.button} ${styles.secondary}`}
                  >
                    Tạo tài khoản
                  </Link>
                </div>
              </>
            )}
            {/* Cuối DOM để Tab đi qua nội dung trước; hiển thị ở góc trên phải */}
            <button
              type="button"
              className={styles.close}
              onClick={() => close(true)}
              aria-label="Đóng"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
