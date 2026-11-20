import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { queryKeys } from '../../../shared/api/queryKeys';
import { signOut } from '../../../shared/auth/token';
import { clearCartSession } from '../../cart/lib/afterSignIn';
import { clearCheckoutItems } from '../../orders/lib/checkoutStorage';

/** Trang bắt buộc đăng nhập: đăng xuất ở đây thì về trang chủ (design-system §9.17) */
const SIGNED_IN_ONLY = ['/orders', '/checkout', '/admin', '/account'];

export const isSignedInOnly = (path: string) =>
  SIGNED_IN_ONLY.some((p) => path === p || path.startsWith(`${p}/`));

export interface SignOutAndLeaveOptions {
  /** Đăng xuất mọi nơi (đổi mật khẩu xong, account.md BR-14). Lỗi thì ném ra, giữ phiên máy này */
  global?: boolean;
  /** Trang đích. Mặc định: về `/` nếu đang ở trang bắt buộc đăng nhập, không thì ở nguyên */
  to?: string;
  /** State mang sang trang đích, vd. `{ email, from, notice }` cho /login */
  state?: unknown;
}

/**
 * Đăng xuất kèm dọn dữ liệu phiên trên trình duyệt (account.md BR-09), dùng chung cho menu tài khoản,
 * trang tài khoản, đổi mật khẩu và quên mật khẩu khi đang đăng nhập.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    async ({ global = false, to, state }: SignOutAndLeaveOptions = {}) => {
      if (global) {
        // Thu hồi phiên mọi nơi lỗi: ném ra trước khi dọn gì, máy này còn đăng nhập để thử lại
        await signOut({ global: true });
      } else {
        try {
          await signOut();
        } catch {
          // Đăng xuất máy này không chặn việc dọn dữ liệu phiên bên dưới
        }
      }
      // Hết phiên trên trình duyệt này: giỏ khách rỗng, không để lại giỏ và đơn của người vừa dùng.
      // Gợi ý "Dành cho bạn" cũng là dữ liệu riêng của người đó. Danh sách sản phẩm vẫn giữ.
      clearCartSession(queryClient);
      clearCheckoutItems();
      queryClient.removeQueries({ queryKey: queryKeys.orders.all });
      queryClient.removeQueries({ queryKey: queryKeys.recs.all });
      queryClient.removeQueries({ queryKey: queryKeys.admin.all });
      queryClient.removeQueries({ queryKey: queryKeys.account.all });

      const target = to ?? (isSignedInOnly(pathname) ? '/' : undefined);
      if (target) navigate(target, { replace: true, state });
    },
    [queryClient, navigate, pathname],
  );
}
