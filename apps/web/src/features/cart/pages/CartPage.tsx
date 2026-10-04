import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Cart } from '../../../shared/api/types';
import {
  canSelect,
  getSelectedItems,
  toggleAll as toggleAllIds,
  toggleOne,
  unavailableReason,
} from '../lib/selection';
import { formatVnd } from '../../../shared/lib/format';

export function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Dữ liệu giỏ hàng ──────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.cart.mine(),
    queryFn: () => api.get<Cart>('/cart'),
  });

  const items = data?.items ?? [];

  // ── Trạng thái tick chọn ──────────────────────────────────────────────────
  // Lưu món khách đã BỎ chọn (xem lib/selection.ts). Mặc định rỗng = chọn tất cả món hợp lệ,
  // nên không cần useEffect/useMemo để "tự chọn khi dữ liệu load xong".
  const [deselected, setDeselected] = useState<Set<string>>(() => new Set());

  const selectedItems = getSelectedItems(items, deselected);
  const selectedIds = new Set(selectedItems.map((i) => i.productId));
  const selectableItems = items.filter(canSelect);
  const allSelectableSelected =
    selectableItems.length > 0 && selectedItems.length === selectableItems.length;

  const toggleItem = (productId: string) => setDeselected((prev) => toggleOne(prev, productId));
  const toggleAll = () => setDeselected((prev) => toggleAllIds(items, prev));

  // ── Mutation sửa số lượng (cart.md BR-03) ─────────────────────────────────
  // Server là nơi quyết định giới hạn (tồn kho có thể vừa đổi); web chỉ chặn trước cho đỡ gọi thừa
  const updateMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      api.put<Cart>(`/cart/items/${productId}`, { quantity }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.all }),
  });
  const updateError =
    updateMutation.error instanceof ApiError && updateMutation.error.code === 'QUANTITY_LIMIT'
      ? `Không thể tăng thêm: chỉ còn thêm được ${updateMutation.error.maxAddable ?? 0} sản phẩm.`
      : updateMutation.isError
        ? 'Không cập nhật được số lượng, vui lòng thử lại.'
        : null;

  // ── Mutation xoá khỏi giỏ ─────────────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/cart/items/${productId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.all }),
  });

  // ── Tổng tiền của các món đã tick ─────────────────────────────────────────
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // ── Chuyển sang checkout ───────────────────────────────────────────────────
  const handleCheckout = () => {
    if (selectedItems.length === 0) return;
    // Truyền danh sách items đã chọn qua navigation state
    navigate('/checkout', { state: { selectedItems } });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) return <p>Đang tải giỏ hàng...</p>;
  if (isError) return <p>Không thể tải giỏ hàng.</p>;

  return (
    <div style={{ maxWidth: '860px' }}>
      <h1>Giỏ hàng</h1>
      {updateError && (
        <p role="alert" style={{ color: 'var(--fg-danger)', fontSize: '0.9rem' }}>
          {updateError}
        </p>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Giỏ hàng của bạn đang trống.</p>
          <Link to="/products">Mua sắm ngay</Link>
        </div>
      ) : (
        <>
          {/* ─── Header bảng ─────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 1rem',
              background: 'var(--bg-surface-raised)',
              borderRadius: '8px',
              marginBottom: '0.5rem',
            }}
          >
            <input
              type="checkbox"
              checked={allSelectableSelected}
              onChange={toggleAll}
              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
              title="Chọn tất cả"
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--fg-subdued)' }}>
              Chọn tất cả ({selectableItems.length} sản phẩm)
            </span>
          </div>

          {/* ─── Danh sách sản phẩm ──────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item) => {
              const selectable = canSelect(item);
              const reason = unavailableReason(item);
              const isSelected = selectedIds.has(item.productId);
              const maxQuantity = Math.min(99, item.stock);
              const changeQuantity = (quantity: number) =>
                updateMutation.mutate({ productId: item.productId, quantity });

              return (
                <div
                  key={item.productId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    border: `1px solid ${isSelected ? 'var(--border-primary)' : 'var(--border-divider)'}`,
                    borderRadius: '8px',
                    background: isSelected ? 'var(--bg-primary-tint)' : 'var(--bg-surface)',
                    opacity: selectable ? 1 : 0.6,
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!selectable}
                    onChange={() => toggleItem(item.productId)}
                    style={{
                      cursor: selectable ? 'pointer' : 'not-allowed',
                      width: '18px',
                      height: '18px',
                      flexShrink: 0,
                    }}
                  />

                  {/* Ảnh */}
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }}
                    />
                  )}

                  {/* Thông tin */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/products/${item.productId}`} style={{ fontWeight: 500 }}>
                      {item.name}
                    </Link>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.25rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      {item.priceChanged && (
                        <span style={{ color: 'var(--fg-warning)' }}>Giá đã thay đổi</span>
                      )}
                      {reason && <span style={{ color: 'var(--fg-warning)' }}>{reason}</span>}
                    </div>
                  </div>

                  {/* Giá + số lượng */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 'bold', margin: 0 }}>{formatVnd(item.price)}</p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '0.35rem',
                        margin: '0.35rem 0',
                      }}
                    >
                      <button
                        onClick={() => changeQuantity(item.quantity - 1)}
                        disabled={item.quantity <= 1 || updateMutation.isPending}
                        aria-label={`Giảm số lượng ${item.name}`}
                      >
                        −
                      </button>
                      <span style={{ minWidth: '2ch', textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => changeQuantity(item.quantity + 1)}
                        disabled={item.quantity >= maxQuantity || updateMutation.isPending}
                        aria-label={`Tăng số lượng ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                    {/* Kho còn ít hơn số trong giỏ: một nút để giảm về đúng số còn lại */}
                    {item.status === 'ACTIVE' && item.stock > 0 && item.stock < item.quantity && (
                      <button
                        onClick={() => changeQuantity(item.stock)}
                        disabled={updateMutation.isPending}
                        style={{ fontSize: '0.8rem' }}
                      >
                        Giảm về {item.stock}
                      </button>
                    )}
                    <p
                      style={{
                        fontWeight: 'bold',
                        color: 'var(--fg-default)',
                        margin: 0,
                        fontSize: '0.9rem',
                      }}
                    >
                      = {formatVnd(item.price * item.quantity)}
                    </p>
                  </div>

                  {/* Nút xoá */}
                  <button
                    onClick={() => removeMutation.mutate(item.productId)}
                    disabled={removeMutation.isPending}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--fg-subdued)',
                      fontSize: '1.2rem',
                      padding: '0.25rem',
                      flexShrink: 0,
                    }}
                    title="Xoá khỏi giỏ"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {/* ─── Thanh tổng + Đặt hàng ───────────────────── */}
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--bg-surface)',
              borderTop: '1px solid var(--border-divider)',
              marginTop: '1rem',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '0 0 8px 8px',
            }}
          >
            <div>
              <span style={{ color: 'var(--fg-subdued)', fontSize: '0.9rem' }}>
                Đã chọn {selectedItems.length}/{items.length} sản phẩm
              </span>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>
                Tổng:{' '}
                <strong className="tabular" style={{ fontSize: '1.25rem' }}>
                  {formatVnd(selectedTotal)}
                </strong>
              </p>
            </div>
            <button
              onClick={handleCheckout}
              disabled={selectedItems.length === 0}
              style={{
                padding: '0.75rem 2rem',
                background:
                  selectedItems.length > 0 ? 'var(--bg-primary)' : 'var(--bg-surface-pressed)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                cursor: selectedItems.length > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
              }}
            >
              Đặt hàng ({selectedItems.length})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
