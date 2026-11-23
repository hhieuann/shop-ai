import type { ButtonHTMLAttributes } from 'react';
import { buttonClass, type ButtonStyle } from './buttonClass';

interface ButtonProps extends ButtonStyle, ButtonHTMLAttributes<HTMLButtonElement> {
  /** Đang xử lý: `aria-busy`, chặn bấm lại; chữ "Đang …" do nơi dùng truyền vào children */
  busy?: boolean;
}

/**
 * Nút bấm (design-system §9.3), mặc định `type="button"` để không vô tình gửi form.
 * Link trông như nút thì dùng `buttonClass` cho `<Link className>`.
 */
export function Button({
  variant,
  size,
  block,
  busy = false,
  type = 'button',
  disabled,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={`${buttonClass({ variant, size, block })} ${className ?? ''}`.trim()}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
    />
  );
}
