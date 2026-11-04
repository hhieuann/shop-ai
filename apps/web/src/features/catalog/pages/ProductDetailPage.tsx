import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Banknote, Search, Truck } from 'lucide-react';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Product } from '../../../shared/api/types';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { Price } from '../../../shared/components/Price';
import { AddToCart } from '../../cart/components/AddToCart';
import { AlsoBought } from '../components/AlsoBought';
import { CategoryIcon } from '../components/CategoryIcon';
import { SpecPanel } from '../components/SpecPanel';
import { SpecTiles } from '../components/SpecTiles';
import { StockBadge } from '../components/StockBadge';
import { categoryLabel } from '../lib/productFilters';
import { specEntries } from '../lib/specLabels';
import styles from './ProductDetailPage.module.css';

/** Ảnh lớn đầu trang: đặt sẵn kích thước để không giật bố cục (ô vuông, tối đa --pdp-media-max) */
const MEDIA_SIZE = 560;

/**
 * Trang chi tiết sản phẩm (docs/web/pages/chi-tiet-san-pham.md). Nền xám, các khối trắng bo 16:
 * cột trái là khối sản phẩm rồi khối thông số, cột phải là hộp mua; "Thường mua kèm" toàn bề ngang.
 */
export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const specTitleId = useId();
  // Panel thông số đang mở: thông số vừa bấm và ô đã mở (đóng xong focus về ô đó)
  const [panel, setPanel] = useState<{ index: number; opener: HTMLElement } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.products.detail(productId!),
    queryFn: () => api.get<Product>(`/products/${productId}`),
    enabled: !!productId,
  });

  if (isLoading) return <DetailSkeleton />;
  // INACTIVE, không có hoặc productId sai dạng đều là 404 (catalog BR-04); không thử lại (retry.ts)
  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  if (error) {
    return (
      <p role="alert" className={styles.message}>
        Chưa tải được sản phẩm. Tải lại trang để thử lần nữa.
      </p>
    );
  }
  if (!data) return null;

  const label = categoryLabel(data.category);
  const categoryHref = `/products?category=${data.category}`;
  const specs = specEntries(data.category, data.specs);
  const soldOut = data.status !== 'ACTIVE' || data.stock <= 0;

  return (
    <>
      <Breadcrumb
        items={[{ label: 'Trang chủ', to: '/' }, { label, to: categoryHref }, { label: data.name }]}
        back={{ label, to: categoryHref }}
      />

      <div className={styles.layout}>
        <div className={`${styles.block} ${styles.product}`}>
          <div className={`${styles.media} ${soldOut ? styles.soldOut : ''}`}>
            {data.imageUrl ? (
              // Phần tử lớn nhất đầu trang: tải ngay, không lazy (§3.2)
              <img
                src={data.imageUrl}
                alt={data.name}
                width={MEDIA_SIZE}
                height={MEDIA_SIZE}
                fetchPriority="high"
                className={styles.image}
              />
            ) : (
              <span className={styles.placeholder}>
                <CategoryIcon category={data.category} size={56} />
              </span>
            )}
          </div>

          <div className={styles.info}>
            <Link to={categoryHref} className={styles.category}>
              <CategoryIcon category={data.category} size={16} />
              {label}
            </Link>
            <h1 className={styles.name}>{data.name}</h1>
            <p className={styles.brand}>Hãng {data.brand}</p>
            <hr className={styles.divider} />
            <h2 className={styles.descriptionTitle}>Mô tả</h2>
            <p className={styles.description}>{data.description}</p>
          </div>
        </div>

        {/* Hộp mua đứng trước khối thông số trong DOM: dưới 960 thứ tự đọc, Tab khớp thứ tự nhìn */}
        <aside aria-label="Mua hàng" className={`${styles.block} ${styles.buy}`}>
          <div className={styles.priceStock}>
            <Price amount={data.price} size="lg" />
            <StockBadge stock={data.stock} status={data.status} />
          </div>
          <div className={styles.shipping}>
            <p className={styles.shippingRow}>
              <Truck size={20} className={styles.truck} aria-hidden="true" />
              <span className={styles.shippingFree}>Giao hàng miễn phí</span>
            </p>
            <p className={styles.shippingRow}>
              <Banknote size={20} className={styles.cash} aria-hidden="true" />
              <span className={styles.cod}>Thanh toán khi nhận hàng (COD)</span>
            </p>
          </div>
          <AddToCart product={data} />
        </aside>

        {specs.length > 0 && (
          // Thông số là ô bấm được, bấm mở panel giải thích (§3.5, §3.6)
          <section aria-labelledby={specTitleId} className={`${styles.block} ${styles.spec}`}>
            <h2 id={specTitleId} className={styles.specTitle}>
              Thông số kỹ thuật
            </h2>
            <SpecTiles rows={specs} onOpen={(index, opener) => setPanel({ index, opener })} />
          </section>
        )}
      </div>

      {panel && (
        <SpecPanel
          category={data.category}
          rows={specs}
          initialIndex={panel.index}
          opener={panel.opener}
          onClose={() => setPanel(null)}
        />
      )}

      {/* Toàn bề ngang, ngoài lưới (§3.7) */}
      <AlsoBought productId={data.productId} />
    </>
  );
}

/** Khung chờ đúng bố cục trang (§4) để nội dung hiện ra không làm xô trang */
function DetailSkeleton() {
  return (
    <>
      <div className={styles.skeletonCrumb} aria-hidden="true" />
      <div className={styles.layout} aria-busy="true">
        <div className={`${styles.block} ${styles.product}`} aria-hidden="true">
          <div className={`${styles.media} ${styles.skeleton}`} />
          <div className={styles.info}>
            <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.w30}`} />
            <span className={`${styles.skeleton} ${styles.skeletonTitle} ${styles.w90}`} />
            <span className={`${styles.skeleton} ${styles.skeletonTitle} ${styles.w60}`} />
            <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.w25}`} />
          </div>
        </div>
        <div className={`${styles.block} ${styles.buy} ${styles.skeletonBuy}`} aria-hidden="true">
          <span className={`${styles.skeleton} ${styles.skeletonFill}`} />
        </div>
      </div>
    </>
  );
}

/** Không có sản phẩm, đã ngừng bán hoặc mã sai (§4) */
function NotFound() {
  return (
    <>
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }]} />
      <div className={styles.empty}>
        <Search size={48} className={styles.emptyIcon} aria-hidden="true" />
        <p className={styles.emptyText}>Sản phẩm không tồn tại hoặc đã bị gỡ.</p>
        <Link to="/products" className={styles.emptyAction}>
          Xem tất cả sản phẩm
        </Link>
      </div>
    </>
  );
}
