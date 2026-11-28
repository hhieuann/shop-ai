import { Link } from 'react-router-dom';
import markUrl from '../assets/logo-mark.webp';
import nameUrl from '../assets/logo-name.webp';
import styles from './Logo.module.css';

/**
 * Logo Black Magic: huy hiệu + chữ tên shop, hai ảnh nền trong suốt hoà vào nền chàm (design-system §9.1,
 * §9.2, #579). Cỡ do nơi dùng quyết định qua biến --logo-mark (cao huy hiệu), --logo-name (cao chữ).
 * Ảnh chỉ để nhìn (alt rỗng); tên đọc cho trình đọc màn hình nằm ở aria-label của link.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`${styles.logo} ${className}`} aria-label="Black Magic, về trang chủ">
      <img className={styles.mark} src={markUrl} alt="" width={115} height={112} decoding="async" />
      <img className={styles.name} src={nameUrl} alt="" width={250} height={68} decoding="async" />
    </Link>
  );
}
