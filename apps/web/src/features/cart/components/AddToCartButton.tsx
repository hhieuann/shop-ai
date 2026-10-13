import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, ShoppingCart } from 'lucide-react';
import { useAnnounce } from '../../../shared/hooks/useAnnounce';
import { useCart, type CartAddable } from '../hooks/useCart';
import { addErrorMessage, addErrorShortLabel } from '../lib/addErrorMessage';
import styles from './AddToCartButton.module.css';

/** Thời gian giữ trạng thái trên nút rồi về bình thường (design-system §9.23) */
export const ADDED_MS = 2000;
export const ERROR_MS = 3000;

type State = { kind: 'idle' } | { kind: 'added' } | { kind: 'error'; label: string };

/**
 * Nút thêm vào giỏ gọn trên thẻ trang danh sách: thêm đúng 1 sản phẩm qua useCart().add
 * (khách chưa đăng nhập thì vào giỏ trên trình duyệt, cart BR-01). Không chuyển trang.
 * Kết quả hiện trên chính nút; câu đọc cho trình đọc màn hình đi qua useAnnounce
 * (vùng thông báo đặt một lần ở cấp trang).
 */
export function AddToCartButton({ product }: { product: CartAddable }) {
  const { add } = useCart();
  const announce = useAnnounce();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const showFor = (next: State, ms: number) => {
    clearTimeout(timer.current);
    setState(next);
    timer.current = setTimeout(() => setState({ kind: 'idle' }), ms);
  };

  const soldOut = product.status !== 'ACTIVE' || product.stock <= 0;
  if (soldOut) {
    return (
      <button type="button" className={styles.button} disabled>
        Hết hàng
      </button>
    );
  }

  const adding = add.isPending;
  const handleClick = () => {
    if (adding) return;
    clearTimeout(timer.current);
    setState({ kind: 'idle' });
    add.mutate(
      { product, quantity: 1 },
      {
        onSuccess: () => {
          showFor({ kind: 'added' }, ADDED_MS);
          announce.polite(`Đã thêm ${product.name} vào giỏ.`);
        },
        onError: (error) => {
          showFor({ kind: 'error', label: addErrorShortLabel(error) }, ERROR_MS);
          announce.alert(addErrorMessage(error));
        },
      },
    );
  };

  const tone = adding
    ? ''
    : state.kind === 'added'
      ? styles.added
      : state.kind === 'error'
        ? styles.error
        : '';

  return (
    <button
      type="button"
      className={`${styles.button} ${tone}`}
      onClick={handleClick}
      aria-label={`Thêm ${product.name} vào giỏ`}
      aria-busy={adding || undefined}
    >
      {adding ? (
        'Đang thêm…'
      ) : state.kind === 'added' ? (
        <>
          <Check size={18} aria-hidden="true" />
          Đã thêm vào giỏ
        </>
      ) : state.kind === 'error' ? (
        <>
          <CircleAlert size={18} aria-hidden="true" />
          {state.label}
        </>
      ) : (
        <>
          <ShoppingCart size={18} aria-hidden="true" />
          Thêm vào giỏ
        </>
      )}
    </button>
  );
}
