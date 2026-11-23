import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSignOutCount } from './token';
import { useSession, type SessionStatus } from './useSession';

export interface RequireSignInOptions {
  /** Lý do mang sang /login cùng `from` (vd. 'checkout': dang-nhap.md §1) */
  reason?: string;
}

/**
 * Trang chỉ dành cho người đã đăng nhập (đơn hàng, đặt hàng, admin, tài khoản): khách chưa đăng nhập thì
 * sang `/login`, đăng nhập xong quay lại đúng trang đang mở (`from`, dang-nhap.md §1).
 * Trả trạng thái phiên để trang chỉ gọi API khi đã là 'signedIn'.
 *
 * Khách tự đăng xuất lúc trang đang mở (số lần đăng xuất tăng so với lúc trang mở) thì không chuyển
 * trang: nơi gọi đăng xuất (useSignOut) tự chuyển, về `/` (design-system §9.17) hoặc trang đích riêng
 * (vd. /login kèm câu báo sau khi đổi mật khẩu). Phiên hết hạn, bị thu hồi, hay mở trang khi chưa đăng
 * nhập (kể cả ngay sau khi đăng xuất) thì sang `/login` như cũ.
 */
export function useRequireSignIn({ reason }: RequireSignInOptions = {}): SessionStatus {
  const session = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Số lần đăng xuất lúc trang mở (chỉ đọc một lần)
  const [signOutsAtMount] = useState(getSignOutCount);

  useEffect(() => {
    if (session !== 'guest' || getSignOutCount() > signOutsAtMount) return;
    navigate('/login', {
      replace: true,
      state: reason ? { from: pathname, reason } : { from: pathname },
    });
  }, [session, navigate, pathname, reason, signOutsAtMount]);

  return session;
}
