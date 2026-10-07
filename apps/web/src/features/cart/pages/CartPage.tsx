import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, ShoppingCart } from 'lucide-react';
import { ApiError } from '../../../shared/api/client';
import { Alert } from '../../../shared/components/Alert';
import { Checkbox } from '../../../shared/components/Checkbox';
import { FreeShipping, OrderSummary } from '../../../shared/components/OrderSummary';
import { Price } from '../../../shared/components/Price';
import { formatVnd } from '../../../shared/lib/format';
import { ProductRail } from '../../home/components/ProductRail';
import { CartLine } from '../components/CartLine';
import { useCart, useGuestLines } from '../hooks/useCart';
import { mergeGuestCartIfAny, saveCheckoutIntent } from '../lib/afterSignIn';
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
 * Dùng chung cho khách vãng lai (giỏ trên trình duyệt) và khách đã đăng nhập (cart BR-01).
 */
export function CartPage() {
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const {
    session,
    isGuest,
    status,
    items,
    update: updateMutation,
    remove: removeMutation,
  } = useCart();

  // Đã đăng nhập mà trình duyệt còn giỏ khách: lần gộp lúc đăng nhập bị lỗi (mạng, server).
  // Báo cho khách và cho bấm gộp lại; cùng Idempotency-Key nên không cộng dồn hai lần (cart BR-10)
  const leftoverGuestLines = useGuestLines();
  const [mergeState, setMergeState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const retryMerge = () => {
    setMergeState('pending');
    mergeGuestCartIfAny(queryClient).then(
      () => setMergeState('idle'),
      () => setMergeState('failed'),
    );
  };
  // Nằm trong cột trái, cùng bề rộng với danh sách món, không lấn sang khối tóm tắt
  const leftoverNotice =
    session === 'signedIn' && leftoverGuestLines.length > 0 ? (
      <Alert
        tone={mergeState === 'failed' ? 'danger' : 'warning'}
        action={
          <button
            type="button"
            className={styles.inlineButton}
            onClick={retryMerge}
            disabled={mergeState === 'pending'}
          >
            {mergeState === 'pending' ? 'Đang gộp…' : 'Gộp vào giỏ'}
          </button>
        }
      >
        {mergeState === 'failed'
          ? 'Vẫn chưa gộp được. Kiểm tra kết nối rồi thử lại.'
          : `Còn ${leftoverGuestLines.length} sản phẩm bạn chọn lúc chưa đăng nhập chưa được thêm vào giỏ.`}
      </Alert>
    ) : null;

  // Lưu món khách đã BỎ chọn (xem lib/selection.ts). Mặc định rỗng = chọn tất cả món hợp lệ
  const [deselected, setDeselected] = useState<Set<string>>(() => new Set());
  const selectedItems = getSelectedItems(items, deselected);
  const selectedIds = new Set(selectedItems.map((i) => i.productId));
  const selectableCount = items.filter(canSelect).length;
  const allSelected = selectableCount > 0 && selectedItems.length === selectableCount;
  const someSelected = selectedItems.length > 0 && !allSelected;
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

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
    if (isGuest) {
      // Đặt hàng bắt buộc đăng nhập (ordering BR-01): nhớ các món đã tick, đăng nhập xong
      // gộp giỏ rồi sang thẳng checkout (cart BR-10, BR-11)
      saveCheckoutIntent({
        items: selectedItems.map(({ productId, quantity }) => ({ productId, quantity })),
      });
      navigate('/login', { state: { from: '/checkout', reason: 'checkout' } });
      return;
    }
    navigate('/checkout', { state: { selectedItems } });
  };

  if (status === 'loading') {
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
  if (status === 'error') {
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
            {leftoverNotice}
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
  const signInHint = isGuest
    ? 'Bạn sẽ đăng nhập hoặc tạo tài khoản ở bước tiếp theo. Các món đã chọn được giữ nguyên.'
    : null;
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
        <div className={styles.main}>
          {leftoverNotice}
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
        </div>

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
          {signInHint && !checkoutHint && <p className={styles.hint}>{signInHint}</p>}
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
