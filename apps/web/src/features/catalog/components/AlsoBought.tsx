import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { RecsResult } from '../../../shared/api/types';
import { Carousel, CarouselItem } from '../../../shared/components/Carousel';
import { StoryBlock } from '../../../shared/components/StoryBlock';
import { useCart } from '../../cart/hooks/useCart';
import { ProductCard } from './ProductCard';

const TITLE = 'Thường mua kèm';
/** Mức tối đa API cho phép (RecsLimit); hàng rộng nhất hiện 7 thẻ */
const RECS_LIMIT = 10;
/** Mức tối đa API cho phép (RecsExclude) */
const MAX_EXCLUDE = 20;

/**
 * Khối "Thường mua kèm" ở cuối trang chi tiết (chi-tiet-san-pham.md §3.6, ADR-0016).
 * API đã bỏ hàng hết và chính sản phẩm đang xem; web loại thêm món đã có trong giỏ.
 *
 * Không có gợi ý, đang tải hoặc lỗi thì không render khối: khối nằm cuối trang nên hiện sau
 * không làm xô lệch nội dung phía trên.
 */
export function AlsoBought({ productId }: { productId: string }) {
  const cart = useCart();
  const exclude = cart.items.map((item) => item.productId).slice(0, MAX_EXCLUDE);

  const { data } = useQuery({
    queryKey: queryKeys.recs.alsoBought(productId, exclude),
    queryFn: () => {
      const params = new URLSearchParams({ productId, limit: String(RECS_LIMIT) });
      if (exclude.length > 0) params.set('exclude', exclude.join(','));
      return api.get<RecsResult>(`/recs/also-bought?${params}`);
    },
    // Chờ biết giỏ có gì rồi mới gọi, tránh gọi hai lần khi giỏ tải xong
    enabled: cart.status !== 'loading',
  });

  if (!data || data.items.length === 0) return null;

  return (
    <StoryBlock title={TITLE}>
      <Carousel label={TITLE}>
        {data.items.map((product) => (
          <CarouselItem key={product.productId}>
            <ProductCard product={product} />
          </CarouselItem>
        ))}
      </Carousel>
    </StoryBlock>
  );
}
