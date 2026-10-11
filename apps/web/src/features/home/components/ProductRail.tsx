import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { ProductListResponse } from '../../../shared/api/types';
import { Carousel, CarouselItem } from '../../../shared/components/Carousel';
import { StoryBlock } from '../../../shared/components/StoryBlock';
import { ProductCard } from '../../catalog/components/ProductCard';
import { toProductsQuery, type ProductFilters } from '../../catalog/lib/productFilters';
import styles from './ProductRail.module.css';

interface ProductRailProps {
  title: string;
  filters: ProductFilters;
  /** Link "Xem tất cả" tới trang danh sách với cùng bộ lọc */
  seeAllTo: string;
}

const RAIL_SIZE = 12;
/** Số khung chờ: đủ một hàng ở màn rộng nhất (7 thẻ) */
const SKELETONS = 7;

/** Một khối sản phẩm trên trang chủ (trang-chu.md §3.5), lấy 12 sản phẩm đầu của GET /products */
export function ProductRail({ title, filters, seeAllTo }: ProductRailProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.products.preview({ ...filters, limit: RAIL_SIZE }),
    queryFn: () =>
      api.get<ProductListResponse>(`/products${toProductsQuery(filters, undefined, RAIL_SIZE)}`),
  });

  return (
    <StoryBlock title={title} action={{ label: 'Xem tất cả', to: seeAllTo }}>
      {isError ? (
        <p className={styles.message} role="alert">
          Chưa tải được sản phẩm. Tải lại trang để thử lần nữa.
        </p>
      ) : !isLoading && data?.items.length === 0 ? (
        <p className={styles.message}>Chưa có sản phẩm nào trong mục này.</p>
      ) : (
        <Carousel label={title}>
          {isLoading
            ? Array.from({ length: SKELETONS }, (_, i) => (
                <CarouselItem key={i}>
                  <div className={styles.skeleton} aria-hidden="true" />
                </CarouselItem>
              ))
            : data?.items.map((product) => (
                <CarouselItem key={product.productId}>
                  <ProductCard product={product} />
                </CarouselItem>
              ))}
        </Carousel>
      )}
    </StoryBlock>
  );
}
