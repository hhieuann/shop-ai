import { useOutletContext } from 'react-router-dom';
import type { UserProfile } from '../../../shared/auth/token';

export interface AccountOutletContext {
  /** Hồ sơ người đang đăng nhập (khung trang đã chờ có hồ sơ mới vẽ trang con) */
  user: UserProfile | null;
  /**
   * Gọi trước khi trang tự đăng xuất rồi chuyển đi (đổi mật khẩu xong sang /login kèm email, câu báo):
   * khung trang không chuyển sang /login khi phiên vừa hết, để không đè state của trang (tai-khoan.md 3.2)
   */
  beginLeave: () => void;
}

/** Trang con của /account đọc hồ sơ và beginLeave do AccountLayout đưa xuống */
export const useAccountOutlet = () => useOutletContext<AccountOutletContext>();
