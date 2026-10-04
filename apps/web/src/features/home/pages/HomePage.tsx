import { Link } from 'react-router-dom';
import { Briefcase, Code, Gamepad2, Palette, type LucideIcon } from 'lucide-react';
import { StoryBlock } from '../../../shared/components/StoryBlock';
import { Carousel, CarouselItem } from '../../../shared/components/Carousel';
import { CategoryIcon } from '../../catalog/components/CategoryIcon';
import { CATEGORIES, type ProductCategory } from '../../catalog/lib/productFilters';
import { ProductRail } from '../components/ProductRail';
import styles from './HomePage.module.css';

/** 4 nhóm khách trong project-plan.md; mỗi nhóm dẫn tới loại hàng họ hay mua nhất */
const NEEDS: { title: string; detail: string; category: ProductCategory; icon: LucideIcon }[] = [
  {
    title: 'Chơi game',
    detail: 'Card đồ hoạ, màn hình tần số quét cao, bàn phím cơ',
    category: 'gpu',
    icon: Gamepad2,
  },
  {
    title: 'Làm văn phòng',
    detail: 'Laptop mỏng nhẹ, chuột, balo, hub USB-C',
    category: 'laptop',
    icon: Briefcase,
  },
  {
    title: 'Học lập trình',
    detail: 'Nâng RAM, SSD, thêm màn hình phụ',
    category: 'ram',
    icon: Code,
  },
  {
    title: 'Thiết kế, dựng phim',
    detail: 'Màn hình màu chuẩn, ổ cứng lớn, tản nhiệt',
    category: 'monitor',
    icon: Palette,
  },
];

export function HomePage() {
  return (
    <div className={styles.page}>
      <h1 className="sr-only">Black Magic: laptop và linh kiện PC</h1>

      {/* Hàng 1: hero 7/12 + mua theo nhu cầu 5/12 */}
      <div className={styles.row}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroText}>
            <h2 id="hero-title" className={styles.heroTitle}>
              Mua card đồ hoạ, biết luôn nên lắp nguồn nào
            </h2>
            <p className={styles.heroBody}>
              Black Magic gợi ý món đi kèm từ chính những đơn hàng trước. Chọn GPU sẽ thấy bộ nguồn
              phù hợp, chọn laptop sẽ thấy chuột và balo hay được mua cùng.
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
            <span className={styles.chip}>
              <CategoryIcon category="gpu" size={56} />
            </span>
            <span className={styles.plus}>+</span>
            <span className={styles.chip}>
              <CategoryIcon category="psu" size={56} />
            </span>
          </div>
        </section>

        <StoryBlock title="Mua theo nhu cầu" className={styles.side}>
          <ul className={styles.needs}>
            {NEEDS.map(({ title, detail, category, icon: Icon }) => (
              <li key={title}>
                <Link to={`/products?category=${category}`} className={styles.need}>
                  <Icon
                    size={24}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={styles.needIcon}
                  />
                  <span>
                    <span className={styles.needTitle}>{title}</span>
                    <span className={styles.needDetail}>{detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </StoryBlock>
      </div>

      {/* Hàng 2: ô loại hàng (ô có viền và icon) */}
      <StoryBlock title="Danh mục">
        <Carousel label="Danh mục" centered>
          {CATEGORIES.map((c) => (
            <CarouselItem key={c.value}>
              <Link to={`/products?category=${c.value}`} className={styles.tile}>
                <span className={styles.tileCircle}>
                  <CategoryIcon category={c.value} size={32} />
                </span>
                <span className={styles.tileLabel}>{c.label}</span>
              </Link>
            </CarouselItem>
          ))}
        </Carousel>
      </StoryBlock>

      {/* Chỗ cho widget "Dành cho bạn" của An (GET /api/v1/recs), đặt ngay dưới danh mục */}

      <ProductRail title="Hàng mới về" filters={{}} seeAllTo="/products" />
      <ProductRail
        title="Card đồ hoạ"
        subtitle="Nhớ xem gợi ý bộ nguồn đi kèm ở trang sản phẩm"
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
