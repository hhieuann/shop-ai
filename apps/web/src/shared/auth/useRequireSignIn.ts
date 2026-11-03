import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession, type SessionStatus } from './useSession';

/**
 * Trang chỉ dành cho người đã đăng nhập (đơn hàng): khách chưa đăng nhập thì sang `/login`,
 * đăng nhập xong quay lại đúng trang đang mở (`from`, dang-nhap.md §1).
 * Trả trạng thái phiên để trang chỉ gọi API khi đã là 'signedIn'.
 */
export function useRequireSignIn(): SessionStatus {
  const session = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (session === 'guest') navigate('/login', { replace: true, state: { from: pathname } });
  }, [session, navigate, pathname]);

  return session;
}
