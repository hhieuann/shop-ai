import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Clapperboard,
  CodeXml,
  Gamepad2,
  LayoutGrid,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  SEARCH_MAX_LENGTH,
  normalizeSearch,
  searchWithoutPaging,
} from '../features/catalog/lib/productFilters';
import { DESKTOP_QUERY, useMediaQuery } from '../shared/hooks/useMediaQuery';
import { useScrolledDown } from '../shared/hooks/useScrolledDown';
import { AccountMenu } from './AccountMenu';
import { CategoryMenuButton } from './CategoryMenuButton';
import { Logo } from './Logo';
import styles from './Header.module.css';

/** Hàng 2 của header: mua theo nhu cầu (design-system §9.1), đường dẫn là bộ lọc đã có */
const NEEDS: { label: string; icon: LucideIcon; search: string }[] = [
  { label: 'Hàng mới về', icon: Sparkles, search: '?sort=newest' },
  { label: 'Chơi game', icon: Gamepad2, search: '?category=gpu' },
  { label: 'Làm văn phòng', icon: Briefcase, search: '?category=laptop' },
  { label: 'Học lập trình', icon: CodeXml, search: '?category=ram' },
  { label: 'Thiết kế, dựng phim', icon: Clapperboard, search: '?category=monitor' },
  { label: 'Tất cả sản phẩm', icon: LayoutGrid, search: '' },
];

/**
 * Header chung, hai hàng, dính đầu trang (design-system §9.1).
 * Hàng 1 nền chàm: logo, nút Danh mục + ô tìm kiếm, Đơn hàng, tài khoản, giỏ.
 * Hàng 2 nền trắng (≥1280px): 6 link mua theo nhu cầu.
 * Dưới 1280px: nút menu, logo giữa, tài khoản, giỏ; ô tìm kiếm xuống hàng riêng.
 *
 * `collapseNeeds` (route có `handle.headerNeeds = 'collapse'`, chỉ trang chi tiết): từ 1280px chỉ hàng 1
 * dính, hàng 2 nằm trong luồng trang và mờ đi khi đã cuộn (design-system §9.1 "Hàng 2 thu lại khi cuộn").
 * Khối bọc là <div> để đổi sang `display: contents` mà không mất landmark của <header>.
 */
export function Header({ collapseNeeds = false }: { collapseNeeds?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const onProducts = location.pathname === '/products';
  const urlQ = onProducts ? (searchParams.get('q') ?? '') : '';

  // Ô tìm kiếm theo URL: mở link /products?q=rtx thì ô hiện "rtx"; rời trang danh sách thì xoá
  const [text, setText] = useState(urlQ);
  useEffect(() => setText(urlQ), [urlQ]);

  const desktop = useMediaQuery(DESKTOP_QUERY);
  const needsHidden = useScrolledDown(collapseNeeds && desktop);

  // React 18 chưa nhận prop inert: đặt thẳng lên DOM để Tab và trình đọc màn hình bỏ qua hàng 2 đã ẩn
  const needsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    needsRef.current?.toggleAttribute('inert', needsHidden);
  }, [needsHidden]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = normalizeSearch(text);
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };

  return (
    <div
      className={[
        styles.header,
        collapseNeeds && styles.collapse,
        needsHidden && styles.needsHidden,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className={styles.topBar}>
        <div className={styles.top}>
          <Logo className={styles.logo} />

          <div className={styles.middle}>
            <CategoryMenuButton />
            <form className={styles.search} role="search" onSubmit={submit}>
              <input
                type="search"
                className={styles.searchInput}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tìm laptop, card đồ hoạ, RAM…"
                maxLength={SEARCH_MAX_LENGTH}
                aria-label="Tìm sản phẩm theo tên"
              />
              <button type="submit" className={styles.searchButton} aria-label="Tìm">
                <Search size={18} aria-hidden="true" />
              </button>
            </form>
          </div>

          <nav className={styles.actions} aria-label="Tài khoản và giỏ hàng">
            <NavLink to="/orders" className={`${styles.action} ${styles.orders}`}>
              <Package size={28} aria-hidden="true" />
              <span className={styles.actionLabel}>Đơn hàng</span>
            </NavLink>
            <AccountMenu />
            {/* Giỏ hàng chỉ có icon, ngăn với nút tài khoản bằng một vạch dọc */}
            <span className={styles.divider} aria-hidden="true" />
            <NavLink to="/cart" className={`${styles.action} ${styles.cart}`} aria-label="Giỏ hàng">
              <ShoppingCart size={30} aria-hidden="true" />
            </NavLink>
          </nav>
        </div>
      </header>

      <nav ref={needsRef} className={styles.needs} aria-label="Mua theo nhu cầu">
        <ul className={styles.needList}>
          {NEEDS.map(({ label, icon: Icon, search }) => {
            // Bỏ cursor, page khi so: đang ở trang 2 của "Chơi game" vẫn đánh dấu "Chơi game"
            const current = onProducts && searchWithoutPaging(location.search) === search;
            return (
              <li key={label}>
                {/* Link thường: NavLink coi mọi link /products là trang hiện tại vì bỏ qua query */}
                <Link
                  to={`/products${search}`}
                  className={styles.need}
                  aria-current={current ? 'page' : undefined}
                >
                  <Icon size={20} className={styles.needIcon} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
