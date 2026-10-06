import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, ShoppingCart } from 'lucide-react';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Cart } from '../../../shared/api/types';
import { Checkbox } from '../../../shared/components/Checkbox';
import { FreeShipping, OrderSummary } from '../../../shared/components/OrderSummary';
import { Price } from '../../../shared/components/Price';
import { formatVnd } from '../../../shared/lib/format';
import { ProductRail } from '../../home/components/ProductRail';
import { CartLine } from '../components/CartLine';
import {
  canSelect,
  getSelectedItems,
  toggleAll as toggleAllIds,
  toggleOne,
} from '../lib/selection';
import styles from './CartPage.module.css';

/**
 * Giỏ hàng (docs/web/pages/gio-hang.md): danh sách món bên trái, tóm tắt đơn bên phải.
 * Tổng tiền chỉ tính các món đang tick (cart BR-09).
 */
export function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.cart.mine(),
    queryFn: () => api.get<Cart>('/cart'),
  });
  const items = data?.items ?? [];

  // Lưu món khách đã BỎ chọn (xem lib/selection.ts). Mặc định rỗng = chọn tất cả món hợp lệ
  const [deselected, setDeselected] = useState<Set<string>>(() => new Set());
  const selectedItems = getSelectedItems(items, deselected);
  const selectedIds = new Set(selectedItems.map((i) => i.productId));
  const selectableCount = items.filter(canSelect).length;
  const allSelected = selectableCount > 0 && selectedItems.length === selectableCount;
  const someSelected = selectedItems.length > 0 && !allSelected;
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Server quyết định giới hạn số lượng (tồn kho có thể vừa đổi); web chỉ chặn trước
  const updateMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      api.put<Cart>(`/cart/items/${productId}`, { quantity }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.all }),
  });
  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/cart/items/${productId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.all }),
  });
  const updateError =
    updateMutation.error instanceof ApiError && updateMutation.error.code === 'QUANTITY_LIMIT'
      ? `Không thể tăng thêm: chỉ còn thêm được ${updateMutation.error.maxAddable ?? 0} sản phẩm.`
      : updateMutation.isError
        ? 'Không cập nhật được số lượng, vui lòng thử lại.'
        : null;
  const busyId = updateMutation.isPending
    ? updateMutation.variables?.productId
    : removeMutation.isPending
      ? removeMutation.variables
      : undefined;

  const checkout = () => {
    if (selectedItems.length === 0) return;
    navigate('/checkout', { state: { selectedItems } });
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Giỏ hàng</h1>
        <div className={styles.layout} aria-busy="true">
          <div className={styles.skeletonList} aria-hidden="true" />
          <div className={styles.skeletonSummary} aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Giỏ hàng</h1>
        <p className={styles.message} role="alert">
          Chưa tải được giỏ hàng. Tải lại trang để thử lần nữa.
        </p>
      </div>
    );
  }

  // ── Giỏ rỗng: vẫn giữ bố cục hai cột, khối tóm tắt ghi 0₫ và nút đi mua tiếp ──
  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Giỏ hàng của bạn đang trống</h1>
        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={styles.empty} aria-label="Giỏ hàng trống">
              <ShoppingCart size={48} strokeWidth={1.75} aria-hidden="true" />
              <p className={styles.emptyText}>
                Chưa có sản phẩm nào trong giỏ. Xem hàng mới về bên dưới, hoặc{' '}
                <Link to="/products">xem tất cả sản phẩm</Link>.
              </p>
            </section>
            <ProductRail title="Hàng mới về" filters={{}} seeAllTo="/products" />
          </div>
          <OrderSummary title="Tóm tắt đơn hàng" rows={[]} total={0}>
            <Link to="/products" className={styles.primaryButton}>
              Tiếp tục mua sắm
            </Link>
          </OrderSummary>
        </div>
      </div>
    );
  }

  const checkoutLabel = `Đặt hàng (${selectedItems.length})`;
  const checkoutHint =
    selectableCount === 0
      ? 'Các sản phẩm trong giỏ hiện chưa đặt được.'
      : selectedItems.length === 0
        ? 'Chọn ít nhất 1 sản phẩm để đặt hàng.'
        : null;

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Giỏ hàng</h1>
        <span className={styles.count}>({items.length} sản phẩm)</span>
      </div>
      {updateError && (
        <p className={styles.alert} role="alert">
          {updateError}
        </p>
      )}

      <div className={styles.layout}>
        <section className={styles.list} aria-label="Sản phẩm trong giỏ">
          <label className={styles.selectAll}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              disabled={selectableCount === 0}
              onChange={() => setDeselected((prev) => toggleAllIds(items, prev))}
            />
            Chọn tất cả ({selectableCount})
          </label>
          <ul className={styles.lines}>
            {items.map((item) => (
              <CartLine
                key={item.productId}
                item={item}
                selected={selectedIds.has(item.productId)}
                busy={busyId === item.productId}
                onToggle={() => setDeselected((prev) => toggleOne(prev, item.productId))}
                onQuantityChange={(quantity) =>
                  updateMutation.mutate({ productId: item.productId, quantity })
                }
                onRemove={() => removeMutation.mutate(item.productId)}
              />
            ))}
          </ul>
        </section>

        <OrderSummary
          className={styles.summary}
          title="Tóm tắt đơn hàng"
          rows={[
            {
              label: `Tạm tính (${selectedItems.length} sản phẩm)`,
              value: formatVnd(selectedTotal),
            },
            { label: 'Phí vận chuyển', value: <FreeShipping /> },
          ]}
          total={selectedTotal}
        >
          <button
            type="button"
            className={styles.primaryButton}
            onClick={checkout}
            disabled={selectedItems.length === 0}
          >
            {checkoutLabel}
          </button>
          {checkoutHint && <p className={styles.hint}>{checkoutHint}</p>}
          <p className={styles.hint}>
            <Banknote size={16} aria-hidden="true" /> Thanh toán khi nhận hàng (COD)
          </p>
        </OrderSummary>
      </div>

      {/* Điện thoại: khối tóm tắt ẩn đi, thay bằng thanh tổng dính đáy màn hình */}
      <div className={styles.mobileBar}>
        <div>
          <span className={styles.mobileBarLabel}>Tổng ({selectedItems.length})</span>
          <Price amount={selectedTotal} />
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={checkout}
          disabled={selectedItems.length === 0}
        >
          {checkoutLabel}
        </button>
      </div>
    </div>
  );
}
