import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api/queryKeys';
import { getTwoFactorEnabled } from '../../../shared/auth/token';

/**
 * Xác thực hai lớp đang bật hay tắt (pages/tai-khoan.md 3.1; admin-don-hang.md mục 1). Key theo email
 * để người đăng nhập sau không thấy trạng thái của người trước; đăng xuất thì xoá (useSignOut).
 * `email` trống thì chưa đọc (chưa có hồ sơ, hoặc không cần đọc).
 */
export function useTwoFactorStatus(email: string | undefined) {
  return useQuery({
    queryKey: queryKeys.account.twoFactor(email ?? ''),
    queryFn: getTwoFactorEnabled,
    enabled: Boolean(email),
    // Đọc lại mỗi lần mở trang: có thể vừa bật, tắt ở máy khác
    staleTime: 0,
  });
}
