import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import styles from './MiniHeader.module.css';

export interface MiniHeaderBack {
  /** Đường dẫn của link quay lại, vd. `/cart` */
  to: string;
  /** Chữ của link, vd. "Quay lại giỏ hàng" */
  label: string;
}

/**
 * Header rút gọn của bố cục tập trung (design-system §9.16): chỉ logo về trang chủ và một link
 * quay lại. Không ô tìm kiếm, nút Danh mục, hàng 2, nút tài khoản, icon giỏ; không dính khi cuộn.
 */
export function MiniHeader({ back }: { back?: MiniHeaderBack }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo className={styles.logo} />
        {back && (
          <Link to={back.to} className={styles.back}>
            <ArrowLeft size={20} aria-hidden="true" />
            {back.label}
          </Link>
        )}
      </div>
    </header>
  );
}
