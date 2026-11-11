import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Cart } from '../../../shared/api/types';
import { useSession } from '../../../shared/auth/useSession';
import { loadGuestCart, subscribeGuestCart } from '../lib/guestCart';

/**
 * Số sản phẩm khác nhau trong giỏ (số dòng, tối đa 50 theo cart BR-02) cho nhãn trên icon giỏ ở header.
 * Không dùng useCart() (kể cả useGuestLines trong đó): với giỏ khách, useCart gọi GET /products/{id}
 * cho từng món, và kéo cả hook giỏ vào gói JS đầu tiên của mọi trang; header chỉ cần đếm.
 * - Khách vãng lai: đếm dòng giỏ trên trình duyệt, không gọi API.
 * - Đã đăng nhập: dùng chung cache GET /api/v1/cart với trang giỏ (cùng queryKey).
 * Phiên đang đọc, giỏ đang tải hoặc lỗi: 0 (không hiện số).
 */
export function useCartCount(): number {
  const session = useSession();
  const guestLines = useSyncExternalStore(subscribeGuestCart, loadGuestCart, () => []);
  const serverCart = useQuery({
    queryKey: queryKeys.cart.mine(),
    queryFn: () => api.get<Cart>('/cart'),
    enabled: session === 'signedIn',
  });

  if (session === 'guest') return guestLines.length;
  if (session === 'signedIn') return serverCart.data?.items.length ?? 0;
  return 0;
}
