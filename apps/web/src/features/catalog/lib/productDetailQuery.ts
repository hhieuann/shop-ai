import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Product } from '../../../shared/api/types';

/**
 * Truy vấn chi tiết một sản phẩm (GET /api/v1/products/{productId}), dùng chung cho trang chi tiết
 * (useQuery) và loader của route (tải trước song song với code trang, #367): cùng queryKey, queryFn
 * nên trang lấy luôn dữ liệu loader đã tải, không gọi API lần hai.
 */
export const productDetailQuery = (productId: string) => ({
  queryKey: queryKeys.products.detail(productId),
  queryFn: () => api.get<Product>(`/products/${productId}`),
});
