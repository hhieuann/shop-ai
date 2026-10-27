import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { RecsResult } from '../../../shared/api/types';
import { useSession } from '../../../shared/auth/useSession';
import { Carousel, CarouselItem } from '../../../shared/components/Carousel';
import { StoryBlock } from '../../../shared/components/StoryBlock';
import { ProductCard } from '../../catalog/components/ProductCard';
import styles from './ProductRail.module.css';

/** Mức tối đa API cho phép (RecsLimit); hàng rộng nhất hiện 7 thẻ */
const RECS_LIMIT = 10;
/** Số khung chờ: đủ một hàng ở màn rộng nhất (7 thẻ) */
const SKELETONS = 7;

/**
 * Khối "Đang được mua nhiều" (trang-chu.md §3.6), khối sản phẩm đầu tiên ngay dưới hàng đầu trang.
 * Chưa đăng nhập: hàng bán chạy (ADR-0016). Đã đăng nhập: "Dành cho bạn" (§7); tài khoản chưa có
 * lịch sử thì API tự trả hàng bán chạy.
 *
 * API lỗi hoặc không trả gì thì ẩn khối, không để khối rỗng (§3.6).
 */
export function PopularProducts() {
  const session = useSession();
  const signedIn = session === 'signedIn';

  const { data, isLoading, isError } = useQuery({
    queryKey: signedIn ? queryKeys.recs.forYou() : queryKeys.recs.bestsellers(),
    queryFn: () =>
      api.get<RecsResult>(`/recs/${signedIn ? 'for-you' : 'bestsellers'}?limit=${RECS_LIMIT}`),
    // Chưa biết đã đăng nhập hay chưa thì chờ, tránh gọi bestsellers rồi lại gọi for-you
    enabled: session !== 'loading',
  });

  // Chưa biết đăng nhập hay chưa thì chưa biết tiêu đề nào đúng: không hiện, tránh nháy tiêu đề
  if (session === 'loading' || isError || (data && data.items.length === 0)) return null;

  const title = signedIn ? 'Dành cho bạn' : 'Đang được mua nhiều';
  return (
    <StoryBlock title={title}>
      <Carousel label={title}>
        {isLoading || !data
          ? Array.from({ length: SKELETONS }, (_, i) => (
              <CarouselItem key={i}>
                <div className={styles.skeleton} aria-hidden="true" />
              </CarouselItem>
            ))
          : data.items.map((product) => (
              <CarouselItem key={product.productId}>
                <ProductCard product={product} />
              </CarouselItem>
            ))}
      </Carousel>
    </StoryBlock>
  );
}
