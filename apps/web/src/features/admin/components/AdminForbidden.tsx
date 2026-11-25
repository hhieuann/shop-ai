import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { buttonClass } from '../../../shared/components/buttonClass';
import { EmptyState } from '../../../shared/components/EmptyState';

/**
 * Không có quyền vào trang quản trị (admin-don-hang.md mục 1): khách thường, đọc hồ sơ lỗi, hoặc API
 * trả 403. Dùng chung cho khung quản trị (`AdminLayout`) và từng trang admin.
 */
export function AdminForbidden() {
  return (
    <EmptyState
      icon={ShieldOff}
      message="Bạn không có quyền xem trang này."
      action={
        <Link to="/" className={buttonClass({ variant: 'secondary' })}>
          Về trang chủ
        </Link>
      }
    />
  );
}
