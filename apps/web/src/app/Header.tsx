import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, Search, ShoppingCart, User } from 'lucide-react';
import { useHorizontalScroll } from '../shared/hooks/useHorizontalScroll';
import { CategoryIcon } from '../features/catalog/components/CategoryIcon';
import {
  CATEGORIES,
  SEARCH_MAX_LENGTH,
  normalizeSearch,
} from '../features/catalog/lib/productFilters';
import styles from './Header.module.css';

/**
 * Header chung (nền tím đậm --bg-chrome): logo, ô tìm kiếm, đơn hàng, giỏ, tài khoản;
 * hàng chip loại hàng bên dưới. Tìm kiếm là một ô duy nhất cho cả web: Enter → /products?q=…
 */
export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const onProducts = location.pathname === '/products';
  const urlQ = onProducts ? (searchParams.get('q') ?? '') : '';
  const activeCategory = onProducts ? searchParams.get('category') : null;

  // Ô tìm kiếm theo URL: mở link /products?q=rtx thì ô hiện "rtx"; rời trang danh sách thì xoá
  const [text, setText] = useState(urlQ);
  useEffect(() => setText(urlQ), [urlQ]);

  // Hàng chip dài hơn màn hình → nút ‹ › để cuộn, chỉ hiện khi còn chip ở hướng đó
  const chips = useHorizontalScroll<HTMLUListElement>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = normalizeSearch(text);
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };

  return (
    <header className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.top}>
          <Link to="/" className={styles.logo} aria-label="Black Magic, về trang chủ">
            <span className={styles.mark} aria-hidden="true" />
            <span className={styles.wordmark}>Black Magic</span>
          </Link>

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
              <Search size={28} aria-hidden="true" />
            </button>
          </form>

          <nav className={styles.actions} aria-label="Tài khoản và giỏ hàng">
            <NavLink to="/orders" className={styles.action}>
              <Package size={28} aria-hidden="true" />
              <span className={styles.actionLabel}>Đơn hàng</span>
            </NavLink>
            <NavLink to="/login" className={styles.action}>
              <User size={28} aria-hidden="true" />
              <span className={styles.actionLabel}>Tài khoản</span>
            </NavLink>
            {/* Giỏ hàng chỉ có icon (lớn hơn các mục khác), ngăn với Tài khoản bằng một vạch dọc */}
            <span className={styles.divider} aria-hidden="true" />
            <NavLink to="/cart" className={`${styles.action} ${styles.cart}`} aria-label="Giỏ hàng">
              <ShoppingCart size={32} aria-hidden="true" />
            </NavLink>
          </nav>
        </div>
      </div>

      <nav
        className={[
          styles.categories,
          chips.canPrev ? styles.fadeStart : '',
          chips.canNext ? styles.fadeEnd : '',
        ].join(' ')}
        aria-label="Loại sản phẩm"
      >
        {chips.canPrev && (
          <button
            type="button"
            className={`${styles.chipArrow} ${styles.chipPrev}`}
            onClick={() => chips.scrollByPage(-1)}
            aria-label="Xem các loại hàng phía trước"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        <ul ref={chips.ref} className={styles.chipList}>
          {CATEGORIES.map((c) => (
            <li key={c.value}>
              <Link
                to={`/products?category=${c.value}`}
                className={styles.chip}
                aria-current={activeCategory === c.value ? 'page' : undefined}
              >
                <CategoryIcon category={c.value} size={20} />
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
        {chips.canNext && (
          <button
            type="button"
            className={`${styles.chipArrow} ${styles.chipNext}`}
            onClick={() => chips.scrollByPage(1)}
            aria-label="Xem thêm loại hàng"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        )}
      </nav>
    </header>
  );
}
