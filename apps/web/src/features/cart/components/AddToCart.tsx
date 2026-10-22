import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import type { Product } from '../../../shared/api/types';
import { Alert } from '../../../shared/components/Alert';
import { QuantityStepper } from '../../../shared/components/QuantityStepper';
import { useCart } from '../hooks/useCart';
import { addErrorMessage } from '../lib/addErrorMessage';
import styles from './AddToCart.module.css';

/**
 * Chọn số lượng và thêm vào giỏ. Khách chưa đăng nhập vẫn thêm được: món vào giỏ trên
 * trình duyệt, chỉ phải đăng nhập lúc đặt hàng (cart.md BR-01).
 */
export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const maxQuantity = Math.min(99, product.stock); // cart.md BR-03
  const [quantity, setQuantity] = useState(1);

  const canBuy = product.status === 'ACTIVE' && product.stock > 0;
  if (!canBuy) {
    return (
      <div className={styles.box}>
        <button type="button" className={styles.primary} disabled>
          Hết hàng
        </button>
      </div>
    );
  }

  const handleAdd = () => add.mutate({ product, quantity }, { onSuccess: () => setQuantity(1) });

  return (
    <div className={styles.box}>
      <div className={styles.row}>
        <span className={styles.label}>Số lượng</span>
        <QuantityStepper
          value={quantity}
          max={maxQuantity}
          onChange={(next) => setQuantity(Math.min(maxQuantity, Math.max(1, next)))}
          itemName={product.name}
        />
      </div>

      <button
        type="button"
        className={styles.primary}
        onClick={handleAdd}
        disabled={add.isPending}
        aria-busy={add.isPending || undefined}
      >
        {add.isPending ? 'Đang thêm…' : 'Thêm vào giỏ'}
      </button>

      {add.isSuccess && (
        <Alert tone="success">
          Đã thêm vào giỏ. <Link to="/cart">Xem giỏ hàng</Link>
        </Alert>
      )}
      {add.isError && (
        <Alert tone="danger">
          {addErrorMessage(add.error)}
          {add.error instanceof ApiError && add.error.status === 401 && (
            <>
              {' '}
              <Link to="/login" state={{ from: `/products/${product.productId}` }}>
                Đăng nhập
              </Link>
            </>
          )}
        </Alert>
      )}
    </div>
  );
}
