import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession, type SessionStatus } from './useSession';

export interface RequireSignInOptions {
  /**
   * Trang đang tự rời đi sau khi đăng xuất (vd. đổi mật khẩu xong sang /login kèm email và câu báo,
   * pages/tai-khoan.md 3.2): trả true thì không chuyển sang /login khi phiên vừa thành khách, để
   * không đè mất state của trang. Đọc lúc phiên đổi (không cần vẽ lại). Mặc định không rời trang.
   */
  isLeaving?: () => boolean;
}

/**
 * Trang chỉ dành cho người đã đăng nhập (đơn hàng, tài khoản): khách chưa đăng nhập thì sang `/login`,
 * đăng nhập xong quay lại đúng trang đang mở (`from`, dang-nhap.md §1).
 * Trả trạng thái phiên để trang chỉ gọi API khi đã là 'signedIn'.
 */
export function useRequireSignIn(options: RequireSignInOptions = {}): SessionStatus {
  const session = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Giữ hàm mới nhất mà không đưa vào danh sách phụ thuộc của effect (trang hay truyền hàm viết tại chỗ)
  // Ghi ref trong effect (không ghi lúc render); đặt trước effect điều hướng nên luôn mới khi được đọc
  const isLeavingRef = useRef(options.isLeaving);
  useEffect(() => {
    isLeavingRef.current = options.isLeaving;
  });

  useEffect(() => {
    if (session !== 'guest' || isLeavingRef.current?.()) return;
    navigate('/login', { replace: true, state: { from: pathname } });
  }, [session, navigate, pathname]);

  return session;
}
