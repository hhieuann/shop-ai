import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonClass } from './buttonClass';
import { EmptyState } from './EmptyState';
import styles from './NotFoundPage.module.css';

/**
 * Trang 404 của route `*` (docs/web/pages/khong-tim-thay.md): đường dẫn không khớp route nào.
 * Header đầy đủ giữ nguyên (RootLayout) để khách tìm tiếp ngay; không gọi API.
 */
export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <EmptyState
        className={styles.block}
        icon={SearchX}
        title="Không tìm thấy trang"
        titleLevel={1}
        message="Đường dẫn có thể đã sai hoặc trang đã bị gỡ. Bạn có thể tìm sản phẩm ở ô tìm kiếm phía trên."
        action={
          <>
            <Link to="/" className={buttonClass({ variant: 'primary' })}>
              Về trang chủ
            </Link>
            <Link to="/products" className={buttonClass()}>
              Xem tất cả sản phẩm
            </Link>
          </>
        }
      />
    </div>
  );
}
