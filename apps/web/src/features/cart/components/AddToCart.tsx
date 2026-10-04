import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Cart, Product } from '../../../shared/api/types';
import { getAccessToken } from '../../../shared/auth/token';
import { savePendingAdd, takePendingAdd } from '../lib/pendingAdd';

/** Thông báo theo mã lỗi của CartProblem (cart.md "Trường hợp đặc biệt") */
function addErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không kết nối được máy chủ, vui lòng thử lại.';
  switch (error.code) {
    case 'QUANTITY_LIMIT':
      return error.maxAddable
        ? `Chỉ thêm được tối đa ${error.maxAddable} sản phẩm nữa (giỏ đã có món này hoặc kho không đủ).`
        : 'Giỏ đã có số lượng tối đa của sản phẩm này.';
    case 'PRODUCT_UNAVAILABLE':
      return 'Sản phẩm đã ngừng bán.';
    case 'CART_FULL':
      return 'Giỏ hàng đã đủ 50 sản phẩm. Hãy đặt hàng hoặc xoá bớt.';
    default:
      return error.detail ?? error.title;
  }
}

export function AddToCart({ product }: { product: Product }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const maxQuantity = Math.min(99, product.stock); // cart.md BR-03
  const [quantity, setQuantity] = useState(1);

  const addItem = useMutation({
    mutationFn: (qty: number) =>
      api.post<Cart>('/cart/items', { productId: product.productId, quantity: qty }),
    onSuccess: (cart) => {
      // Response là giỏ mới → ghi thẳng vào cache, trang giỏ mở ra là có ngay
      queryClient.setQueryData(queryKeys.cart.mine(), cart);
      setQuantity(1);
    },
    onError: (error, qty) => {
      // Token hết hạn giữa chừng → cũng đi đăng nhập rồi quay lại thêm tiếp
      if (error instanceof ApiError && error.status === 401) goLogin(qty);
    },
  });

  const goLogin = (qty: number) => {
    savePendingAdd({ productId: product.productId, quantity: qty });
    navigate('/login', { state: { from: location.pathname } });
  };

  const handleAdd = async () => {
    // Biết chắc chưa đăng nhập thì đi đăng nhập luôn, khỏi gọi API để nhận 401
    if (!(await getAccessToken())) return goLogin(quantity);
    addItem.mutate(quantity);
  };

  // Vừa đăng nhập xong quay lại trang này → tự thêm món đã định thêm (cart.md BR-01)
  const { mutate } = addItem;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await getAccessToken()) || cancelled) return;
      const pending = takePendingAdd(product.productId);
      if (pending) mutate(pending.quantity);
    })();
    return () => {
      cancelled = true;
    };
  }, [product.productId, mutate]);

  const canBuy = product.status === 'ACTIVE' && product.stock > 0;
  if (!canBuy) {
    return (
      <button disabled style={{ marginTop: '1rem', padding: '0.75rem 1.5rem' }}>
        Hết hàng
      </button>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label htmlFor="add-qty">Số lượng</label>
        <button
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Giảm số lượng"
        >
          −
        </button>
        <input
          id="add-qty"
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => {
            const n = Math.trunc(Number(e.target.value));
            setQuantity(Number.isFinite(n) ? Math.min(maxQuantity, Math.max(1, n)) : 1);
          }}
          style={{ width: '4rem', textAlign: 'center' }}
        />
        <button
          onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          disabled={quantity >= maxQuantity}
          aria-label="Tăng số lượng"
        >
          +
        </button>
      </div>

      <button
        onClick={handleAdd}
        disabled={addItem.isPending}
        style={{
          marginTop: '0.75rem',
          padding: '0.75rem 1.5rem',
          background: 'var(--bg-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: addItem.isPending ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
        }}
      >
        {addItem.isPending ? 'Đang thêm...' : 'Thêm vào giỏ'}
      </button>

      {addItem.isSuccess && (
        <p role="status" style={{ color: 'var(--fg-success)' }}>
          Đã thêm vào giỏ. <Link to="/cart">Xem giỏ hàng</Link>
        </p>
      )}
      {addItem.isError && !(addItem.error instanceof ApiError && addItem.error.status === 401) && (
        <p role="alert" style={{ color: 'var(--fg-danger)' }}>
          {addErrorMessage(addItem.error)}
        </p>
      )}
    </div>
  );
}
