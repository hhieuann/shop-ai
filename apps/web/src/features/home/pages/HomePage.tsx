import { Link } from 'react-router-dom';
import {
  Backpack,
  ChevronRight,
  CircuitBoard,
  Cpu,
  Gpu,
  Laptop,
  MemoryStick,
  Mouse,
  PlugZap,
  Plus,
  Sparkles,
  Truck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useAccount } from '../../../shared/auth/useSession';
import { CategoryMenu } from '../../catalog/components/CategoryMenu';
import { PopularProducts } from '../components/PopularProducts';
import { ProductRail } from '../components/ProductRail';
import styles from './HomePage.module.css';

/**
 * Ba ô "Thường mua kèm" (trang-chu.md §3.4). Mô tả chỉ nêu thông số có trong bộ dữ liệu demo,
 * không khẳng định "tương thích" (catalog BR-06).
 */
const PAIRS: { icons: LucideIcon[]; title: string; detail: string; to: string }[] = [
  {
    icons: [Gpu, PlugZap],
    title: 'Card đồ hoạ + Nguồn',
    detail: 'RTX 4070 Super cần nguồn từ 750W',
    to: '/products?category=psu',
  },
  {
    icons: [Cpu, CircuitBoard, MemoryStick],
    title: 'CPU + Mainboard + RAM',
    detail: 'Cùng socket AM5 hoặc LGA1700, cùng chuẩn DDR',
    to: '/products?category=mainboard',
  },
  {
    icons: [Laptop, Mouse, Backpack],
    title: 'Laptop + Chuột + Balo',
    detail: 'Bộ đi học, đi làm thường mua cùng',
    to: '/products?category=mouse',
  },
];

/** Trang chủ (docs/web/pages/trang-chu.md) */
export function HomePage() {
  const { status } = useAccount();
  const signedIn = status === 'signedIn';

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Black Magic: laptop và linh kiện PC</h1>

      {/* Hàng đầu trang: menu danh mục | hero + 2 ô thông tin | 3 ô thường mua kèm */}
      <div className={styles.top}>
        <CategoryMenu className={styles.categories} />

        <div className={styles.center}>
          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroText}>
              <span className={styles.eyebrow}>
                <Sparkles size={14} aria-hidden="true" />
                Gợi ý mua kèm
              </span>
              <h2 id="hero-title" className={styles.heroTitle}>
                Mua card đồ hoạ, xem luôn món thường mua kèm
              </h2>
              <p className={styles.heroBody}>
                Mỗi trang sản phẩm có dải &quot;Thường mua kèm&quot;, tính từ các đơn hàng trước.
              </p>
              <div className={styles.heroActions}>
                <Link to="/products?category=gpu" className={styles.heroPrimary}>
                  Xem card đồ hoạ
                </Link>
                <Link to="/products" className={styles.heroSecondary}>
                  Xem tất cả sản phẩm
                </Link>
              </div>
            </div>
            <div className={styles.heroArt} aria-hidden="true">
              <span className={styles.artBox}>
                <Gpu size={60} strokeWidth={1.75} />
              </span>
              <Plus size={28} className={styles.artPlus} />
              <span className={styles.artBox}>
                <PlugZap size={60} strokeWidth={1.75} />
              </span>
            </div>
          </section>

          <div className={`${styles.infoRow} ${signedIn ? styles.infoSingle : ''}`}>
            <div className={styles.info}>
              <span className={styles.infoIcon} aria-hidden="true">
                <Truck size={24} />
              </span>
              <div>
                <h3 className={styles.infoTitle}>Giao hàng miễn phí mọi đơn</h3>
                <p className={styles.infoText}>Thanh toán khi nhận hàng (COD).</p>
              </div>
            </div>
            {/* Đã đăng nhập thì ô này không còn hợp (trang-chu.md §7): ẩn, ô giao hàng rộng hết hàng */}
            {!signedIn && (
              <div className={styles.info}>
                <span className={styles.infoIcon} aria-hidden="true">
                  <UserRound size={24} />
                </span>
                <div>
                  <h3 className={styles.infoTitle}>Chưa có tài khoản?</h3>
                  <p className={styles.infoText}>
                    Giỏ hàng lưu theo tài khoản và theo dõi được đơn.
                  </p>
                  <Link to="/register" state={{ from: '/' }} className={styles.infoLink}>
                    Tạo tài khoản
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <ul className={styles.pairs} aria-label="Thường mua kèm">
          {PAIRS.map(({ icons, title, detail, to }) => (
            <li key={title}>
              <Link to={to} className={styles.pair}>
                <div className={styles.pairIcons} aria-hidden="true">
                  {icons.map((Icon, i) => (
                    <span key={i} className={styles.pairIconGroup}>
                      {i > 0 && <Plus size={14} className={styles.pairPlus} />}
                      <span className={styles.pairIcon}>
                        <Icon size={22} strokeWidth={1.75} />
                      </span>
                    </span>
                  ))}
                </div>
                <div>
                  <h3 className={styles.pairTitle}>{title}</h3>
                  <p className={styles.pairText}>{detail}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <PopularProducts />
      <ProductRail title="Hàng mới về" filters={{}} seeAllTo="/products" />
      <ProductRail
        title="Card đồ hoạ"
        filters={{ category: 'gpu' }}
        seeAllTo="/products?category=gpu"
      />
      <ProductRail
        title="Laptop"
        filters={{ category: 'laptop' }}
        seeAllTo="/products?category=laptop"
      />
    </div>
  );
}
