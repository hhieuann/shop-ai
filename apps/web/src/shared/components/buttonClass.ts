import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyle {
  /** Mặc định `secondary` (design-system §9.3). Mỗi màn hình chỉ một nút `primary` */
  variant?: ButtonVariant;
  /** Mặc định `md` (40px) */
  size?: ButtonSize;
  /** Rộng 100% khung chứa */
  block?: boolean;
}

/**
 * className của nút theo design-system §9.3. Dùng trực tiếp cho `<Link>` trông như nút
 * (vd. "Mua sắm ngay"); nút bấm thật thì dùng component `Button`.
 * Để riêng file vì file component chỉ nên xuất component (fast refresh của Vite).
 */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  block = false,
}: ButtonStyle = {}): string {
  return [styles.button, styles[variant], styles[size], block ? styles.block : '']
    .filter(Boolean)
    .join(' ');
}
