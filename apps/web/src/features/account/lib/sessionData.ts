import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api/queryKeys';
import { clearCartSession } from '../../cart/lib/afterSignIn';
import { clearCheckoutItems } from '../../orders/lib/checkoutStorage';

/** Trang bắt buộc đăng nhập: đăng xuất ở đây thì về trang chủ (design-system §9.17) */
const SIGNED_IN_ONLY = ['/orders', '/checkout', '/admin', '/account'];

export const isSignedInOnly = (path: string) =>
  SIGNED_IN_ONLY.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Dọn dữ liệu phiên trên trình duyệt (account.md BR-09): giỏ khách rỗng, không để lại giỏ, mục đang
 * đặt dở và đơn của người vừa dùng. Gợi ý "Dành cho bạn", dữ liệu admin, tài khoản cũng là của riêng
 * người đó. Danh sách sản phẩm vẫn giữ.
 *
 * Dùng chung cho nút Đăng xuất (useSignOut) và cho tab nhận tin tab khác vừa đổi người (#508); hàm này
 * không gọi Cognito, không gửi tin cho tab khác.
 */
export function clearSessionData(queryClient: QueryClient) {
  clearCartSession(queryClient);
  clearCheckoutItems();
  queryClient.removeQueries({ queryKey: queryKeys.orders.all });
  queryClient.removeQueries({ queryKey: queryKeys.recs.all });
  queryClient.removeQueries({ queryKey: queryKeys.admin.all });
  queryClient.removeQueries({ queryKey: queryKeys.account.all });
}
