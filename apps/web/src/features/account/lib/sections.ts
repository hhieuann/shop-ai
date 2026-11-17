import { KeyRound, Package, UserRound, type LucideIcon } from 'lucide-react';

export interface AccountSection {
  readonly id: 'info' | 'password' | 'orders';
  readonly label: string;
  readonly icon: LucideIcon;
  readonly to: string;
}

/**
 * Các mục của trang tài khoản (pages/tai-khoan.md 3.3, design-system §9.27). Dùng chung cho cột trái,
 * nút "Đổi mục", bảng chọn mục và đường dẫn. "Đăng xuất" vẽ riêng sau danh sách.
 */
export const ACCOUNT_SECTIONS: readonly AccountSection[] = [
  { id: 'info', label: 'Thông tin tài khoản', icon: UserRound, to: '/account' },
  { id: 'password', label: 'Đổi mật khẩu', icon: KeyRound, to: '/account/password' },
  { id: 'orders', label: 'Đơn hàng của tôi', icon: Package, to: '/orders' },
];

/** Mục đang xem theo đường dẫn; mặc định mục đầu (Thông tin tài khoản) */
export function currentSection(pathname: string): AccountSection {
  const path = pathname.replace(/\/+$/, '') || '/';
  return ACCOUNT_SECTIONS.find((s) => s.to === path) ?? ACCOUNT_SECTIONS[0]!;
}
