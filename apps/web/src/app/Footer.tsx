import { Link } from 'react-router-dom';
import { Banknote, Truck } from 'lucide-react';
import { Logo } from './Logo';
import styles from './Footer.module.css';

const SHOP_LINKS = [
  { label: 'Tất cả sản phẩm', to: '/products' },
  { label: 'Hàng mới về', to: '/products?sort=newest' },
  { label: 'Card đồ hoạ', to: '/products?category=gpu' },
  { label: 'Laptop', to: '/products?category=laptop' },
];
const ACCOUNT_LINKS = [
  { label: 'Đăng nhập', to: '/login' },
  { label: 'Tạo tài khoản', to: '/register' },
  { label: 'Đơn hàng', to: '/orders' },
];

/**
 * Footer 4 cột, cùng màu chàm với header (design-system §9.2).
 * `flush`: không cách nội dung 32px (trang nền trắng như trang danh sách).
 */
export function Footer({ flush = false }: { flush?: boolean }) {
  return (
    <footer className={`${styles.footer} ${flush ? styles.flush : ''}`}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.about}>
            <Logo className={styles.logo} />
            <p className={styles.intro}>
              Laptop và linh kiện PC, có gợi ý món thường mua kèm. Dự án thực tập FCAJ 2026, dữ liệu
              sản phẩm là giả lập.
            </p>
          </div>
          <nav aria-labelledby="footer-shop">
            <h2 id="footer-shop" className={styles.title}>
              Mua sắm
            </h2>
            <ul className={styles.list}>
              {SHOP_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="footer-account">
            <h2 id="footer-account" className={styles.title}>
              Tài khoản
            </h2>
            <ul className={styles.list}>
              {ACCOUNT_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className={styles.title}>Giao hàng và thanh toán</h2>
            <ul className={styles.list}>
              <li>
                <Truck size={18} className={styles.icon} aria-hidden="true" />
                Giao hàng miễn phí mọi đơn
              </li>
              <li>
                <Banknote size={18} className={styles.icon} aria-hidden="true" />
                Thanh toán khi nhận hàng (COD)
              </li>
            </ul>
          </div>
        </div>
        <p className={styles.legal}>
          © 2026 Black Magic · Sản phẩm, giá và tồn kho chỉ dùng để demo.
        </p>
      </div>
    </footer>
  );
}
