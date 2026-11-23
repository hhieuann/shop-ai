import { useOutletContext } from 'react-router-dom';
import type { UserProfile } from '../../../shared/auth/token';

export interface AccountOutletContext {
  /** Hồ sơ người đang đăng nhập (khung trang đã chờ có hồ sơ mới vẽ trang con) */
  user: UserProfile | null;
}

/** Trang con của /account đọc hồ sơ do AccountLayout đưa xuống */
export const useAccountOutlet = () => useOutletContext<AccountOutletContext>();
