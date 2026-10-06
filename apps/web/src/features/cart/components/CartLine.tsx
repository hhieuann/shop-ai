import { Link } from 'react-router-dom';
import { Package, Trash2 } from 'lucide-react';
import type { CartItem } from '../../../shared/api/types';
import { Checkbox } from '../../../shared/components/Checkbox';
import { Price } from '../../../shared/components/Price';
import { QuantityStepper } from '../../../shared/components/QuantityStepper';
import { formatVnd } from '../../../shared/lib/format';
import { canSelect, unavailableReason } from '../lib/selection';
import styles from './CartLine.module.css';

interface CartLineProps {
  item: CartItem;
  selected: boolean;
  /** Đang sửa số lượng hoặc đang xoá dòng này */
  busy: boolean;
  onToggle: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

/** Một dòng trong giỏ (gio-hang.md §3.2): ô tick, ảnh, tên + nhãn, thành tiền + số lượng + xoá */
export function CartLine({
  item,
  selected,
  busy,
  onToggle,
  onQuantityChange,
  onRemove,
}: CartLineProps) {
  const selectable = canSelect(item);
  const reason = unavailableReason(item);
  const soldOut = item.status !== 'ACTIVE' || item.stock <= 0;
  // Còn hàng nhưng ít hơn số trong giỏ: cho giảm, không cho tăng
  const tooMany = !soldOut && item.stock < item.quantity;
  const productUrl = `/products/${item.productId}`;

  return (
    <li className={`${styles.line} ${busy ? styles.busy : ''}`} aria-busy={busy || undefined}>
      <Checkbox
        className={styles.check}
        checked={selected}
        disabled={!selectable || busy}
        onChange={onToggle}
        aria-label={`Chọn ${item.name}`}
      />

      <Link
        to={productUrl}
        className={`${styles.plate} ${selectable ? '' : styles.dim}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" width={80} height={80} loading="lazy" decoding="async" />
        ) : (
          <Package size={32} strokeWidth={1.75} />
        )}
      </Link>

      <div className={styles.info}>
        <Link to={productUrl} className={styles.name}>
          {item.name}
        </Link>
        {(reason || item.priceChanged) && (
          <div className={styles.badges}>
            {reason && (
              <span className={`${styles.badge} ${tooMany ? styles.warning : styles.danger}`}>
                {reason}
              </span>
            )}
            {item.priceChanged && (
              <span className={`${styles.badge} ${styles.warning}`}>Giá đã thay đổi</span>
            )}
            {tooMany && (
              <button
                type="button"
                className={styles.small}
                onClick={() => onQuantityChange(item.stock)}
                disabled={busy}
              >
                Giảm về {item.stock}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.side}>
        <div className={styles.amount}>
          <Price amount={item.price * item.quantity} />
          {item.quantity > 1 && (
            <span className={styles.unit}>{formatVnd(item.price)} / sản phẩm</span>
          )}
        </div>
        <QuantityStepper
          value={item.quantity}
          max={Math.max(1, Math.min(99, item.stock))}
          onChange={onQuantityChange}
          itemName={item.name}
          disabled={busy || soldOut}
        />
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          disabled={busy}
          aria-label={`Xoá ${item.name} khỏi giỏ`}
        >
          <Trash2 size={16} aria-hidden="true" />
          Xoá
        </button>
      </div>
    </li>
  );
}
