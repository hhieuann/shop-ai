import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { ProductListResponse } from '../../../shared/api/types';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { Button } from '../../../shared/components/Button';
import { buttonClass } from '../../../shared/components/buttonClass';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ProductListCard } from '../components/ProductListCard';
import { toProductsQuery } from '../lib/productFilters';
import styles from './NewArrivalsPage.module.css';

/** Số món mới nhất hiện trên trang (không phân trang) */
export const NEW_ARRIVALS_LIMIT = 20;

/**
 * Trang "Hàng mới về" `/new-arrivals` (pages/hang-moi-ve.md): 20 món mới nhất, không lọc, không
 * phân trang; cuối trang link "Xem tất cả sản phẩm". Dùng API danh sách sẵn có với `sort=newest`
 * (hàng hết vẫn xếp cuối theo catalog.md BR-08).
 */
export function NewArrivalsPage() {
  const filters = { sort: 'newest' as const };
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.products.preview({ ...filters, limit: NEW_ARRIVALS_LIMIT }),
    queryFn: () =>
      api.get<ProductListResponse>(
        `/products${toProductsQuery(filters, undefined, NEW_ARRIVALS_LIMIT)}`,
      ),
  });

  useEffect(() => {
    const previous = document.title;
    document.title = 'Hàng mới về | Black Magic';
    return () => {
      document.title = previous;
    };
  }, []);

  const products = data?.items ?? [];
  const seeAll = (
    <Link to="/products" className={buttonClass()}>
      Xem tất cả sản phẩm
    </Link>
  );

  return (
    <div className={styles.page}>
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Hàng mới về' }]} />
      <div className={styles.titleBlock}>
        <h1 className={styles.heading}>Hàng mới về</h1>
        <p className={styles.lead}>{NEW_ARRIVALS_LIMIT} sản phẩm mới nhất của shop</p>
      </div>

      {isPending && (
        // Giữ chỗ cao bằng màn hình: footer không hiện giữa màn hình rồi bị đẩy xuống (CLS)
        <p className={`${styles.message} ${styles.loading}`}>Đang tải sản phẩm…</p>
      )}
      {isError && (
        <div className={styles.error} role="alert">
          <p className={styles.message}>Chưa tải được sản phẩm.</p>
          <Button size="sm" busy={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Đang tải…' : 'Thử lại'}
          </Button>
        </div>
      )}
      {!isPending && !isError && products.length === 0 && (
        <EmptyState message="Shop chưa có sản phẩm nào." action={seeAll} />
      )}
      {products.length > 0 && (
        <>
          <ul className={styles.grid}>
            {products.map((product) => (
              <li key={product.productId} className={styles.item}>
                <ProductListCard product={product} />
              </li>
            ))}
          </ul>
          <div className={styles.more}>{seeAll}</div>
        </>
      )}
    </div>
  );
}
