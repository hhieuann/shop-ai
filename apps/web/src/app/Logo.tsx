import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import styles from './Logo.module.css';

/**
 * Logo Black Magic: ô gradient có icon + chữ (design-system §9.1, §9.2).
 * Cỡ do nơi dùng quyết định qua biến --logo-mark, --logo-icon, --logo-text, --logo-leading.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`${styles.logo} ${className}`} aria-label="Black Magic, về trang chủ">
      <span className={styles.mark} aria-hidden="true">
        <Sparkles className={styles.icon} aria-hidden="true" />
      </span>
      <span className={styles.wordmark}>Black Magic</span>
    </Link>
  );
}
