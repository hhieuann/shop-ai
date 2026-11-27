import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { announceAuthChanged, signOut } from '../../../shared/auth/token';
import { clearSessionData, isSignedInOnly } from './sessionData';

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
      // Hết phiên trên trình duyệt này: dọn giỏ, mục đặt dở, đơn, gợi ý của người vừa dùng
      clearSessionData(queryClient);
      // Khách bấm Đăng xuất ở tab này: báo các tab khác tự dọn theo (#508)
      announceAuthChanged();

      const target = to ?? (isSignedInOnly(pathname) ? '/' : undefined);
      if (target) navigate(target, { replace: true, state });
    },
    [queryClient, navigate, pathname],
  );
}
