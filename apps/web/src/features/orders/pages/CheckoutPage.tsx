import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import { formatVnd } from '../../../shared/lib/format';
import { clearCheckoutItems, loadCheckoutItems, saveCheckoutItems } from '../lib/checkoutStorage';
import type {
  CartItem,
  CreateOrderRequest,
  Order,
  ShippingAddress,
} from '../../../shared/api/types';

/** Món đã tick ở giỏ, truyền sang checkout */
type SelectedItem = Pick<CartItem, 'productId' | 'name' | 'price' | 'quantity'>;

/** Chuẩn hoá trước khi gửi để khớp ràng buộc trong OpenAPI (ShippingAddress) */
const normalizePhone = (phone: string) => phone.replace(/\s/g, '');
const toPayload = (form: ShippingAddress): ShippingAddress => ({
  fullName: form.fullName.trim(),
  phone: normalizePhone(form.phone),
  address: form.address.trim(),
  province: form.province.trim(),
});

/**
 * Server CHẮC CHẮN chưa tạo đơn → lần gửi sau dùng key mới là an toàn.
 * Ngoại lệ: 409 ORDER_IN_PROGRESS nghĩa là lần gửi trước VẪN đang chạy và có thể tạo đơn,
 * nên phải giữ nguyên key để lần bấm sau nhận lại đúng đơn đó.
 */
function isDefiniteFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false; // mạng lỗi: không biết server đã làm gì
  if (error.status === 409) return error.code !== 'ORDER_IN_PROGRESS';
  return error.status === 400 || error.status === 422;
}

export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Nhận danh sách items đã tick từ CartPage qua navigation state.
  // Để trong state vì giá có thể được cập nhật khi server báo PRICE_CHANGED
  // Lưu thêm vào sessionStorage để bấm F5 không mất (navigation state mất khi tải lại trang)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(() =>
    location.state?.selectedItems
      ? saveCheckoutItems(location.state.selectedItems)
      : loadCheckoutItems(),
  );
  const updateSelectedItems = (update: (items: SelectedItem[]) => SelectedItem[]) =>
    setSelectedItems((items) => saveCheckoutItems(update(items)));

  const [form, setForm] = useState<ShippingAddress>({
    fullName: '',
    phone: '',
    address: '',
    province: '',
  });
  const [formError, setFormError] = useState<Partial<ShippingAddress>>({});

  // ── Idempotency-Key (BR-04) ──────────────────────────────────────────────────
  // Sinh MỘT lần cho mỗi lượt checkout và giữ nguyên qua các lần bấm lại.
  // Mạng lỗi / 5xx: không biết server đã tạo đơn chưa → gửi lại CÙNG key, server trả đơn cũ.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // ── Mutation tạo đơn ─────────────────────────────────────────────────────────
  // Mọi hook phải gọi trước bất kỳ lệnh return sớm nào (Rules of Hooks)
  const createOrder = useMutation({
    mutationFn: () =>
      api.post<Order>(
        '/orders',
        {
          // expectedPrice = giá khách đang nhìn thấy; server so với giá hiện tại (ordering.md BR-07)
          items: selectedItems.map(({ productId, quantity, price }) => ({
            productId,
            quantity,
            expectedPrice: price,
          })),
          shippingAddress: toPayload(form),
        } satisfies CreateOrderRequest, // body sai so với OpenAPI → lỗi lúc biên dịch
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    onSuccess: (order) => {
      clearCheckoutItems();
      // Server đã xoá các món đã đặt khỏi giỏ → làm mới cache giỏ và lịch sử đơn
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      // replace: bấm Back không quay lại form checkout đã gửi
      navigate(`/orders/${order.orderId}`, { replace: true, state: { justCreated: true } });
    },
    onError: (error) => {
      if (isDefiniteFailure(error)) setIdempotencyKey(crypto.randomUUID());

      // Giá đổi: hiện giá mới ngay trên trang để khách xem lại rồi bấm xác nhận lần nữa
      if (error instanceof ApiError && error.code === 'PRICE_CHANGED') {
        const newPrice = new Map(error.changedItems.map((c) => [c.productId, c.currentPrice]));
        updateSelectedItems((items) =>
          items.map((i) =>
            newPrice.has(i.productId) ? { ...i, price: newPrice.get(i.productId)! } : i,
          ),
        );
      }
    },
  });

  // ── Nếu vào trang này không qua giỏ → hướng về giỏ ─────────────────────────
  if (selectedItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <p>Không có sản phẩm nào được chọn.</p>
        <button onClick={() => navigate('/cart')}>Quay lại giỏ hàng</button>
      </div>
    );
  }

  const total = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // ── Validate form ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: Partial<ShippingAddress> = {};
    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên';
    if (!form.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^(0|\+84)\d{9}$/.test(normalizePhone(form.phone)))
      errors.phone = 'Số điện thoại không hợp lệ';
    if (!form.address.trim()) errors.address = 'Vui lòng nhập địa chỉ';
    if (!form.province.trim()) errors.province = 'Vui lòng chọn tỉnh/thành phố';
    setFormError(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createOrder.isPending || !validate()) return;
    createOrder.mutate();
  };

  const nameOf = (productId: string) =>
    selectedItems.find((i) => i.productId === productId)?.name ?? productId;

  const fieldStyle = (error?: string): React.CSSProperties => ({
    width: '100%',
    padding: '0.6rem 0.75rem',
    border: `1px solid ${error ? 'var(--fg-danger)' : 'var(--border-input)'}`,
    borderRadius: '6px',
    fontSize: '1rem',
    boxSizing: 'border-box',
  });

  return (
    <div style={{ maxWidth: '800px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: '1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--fg-primary)',
        }}
      >
        ← Quay lại giỏ hàng
      </button>

      <h1>Xác nhận đặt hàng</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          alignItems: 'start',
        }}
      >
        {/* ─── Form địa chỉ ──────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Thông tin giao hàng</h2>

          {[
            {
              key: 'fullName',
              label: 'Họ và tên',
              placeholder: 'Nguyễn Văn A',
              type: 'text',
              maxLength: 100,
            },
            {
              key: 'phone',
              label: 'Số điện thoại',
              placeholder: '0912 345 678',
              type: 'tel',
              maxLength: 16,
            },
            {
              key: 'address',
              label: 'Địa chỉ',
              placeholder: 'Số nhà, tên đường, phường/xã',
              type: 'text',
              maxLength: 200,
            },
            {
              key: 'province',
              label: 'Tỉnh / Thành phố',
              placeholder: 'TP. Hồ Chí Minh',
              type: 'text',
              maxLength: 100,
            },
          ].map(({ key, label, placeholder, type, maxLength }) => (
            <div key={key} style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.35rem',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                {label} <span style={{ color: 'var(--fg-danger)' }}>*</span>
              </label>
              <input
                type={type}
                placeholder={placeholder}
                maxLength={maxLength}
                value={form[key as keyof ShippingAddress]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={fieldStyle(formError[key as keyof ShippingAddress])}
              />
              {formError[key as keyof ShippingAddress] && (
                <p style={{ color: 'var(--fg-danger)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                  {formError[key as keyof ShippingAddress]}
                </p>
              )}
            </div>
          ))}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Phương thức thanh toán</label>
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: 'var(--bg-success-tint)',
                border: '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            >
              💵 Thanh toán khi nhận hàng (COD)
            </div>
          </div>

          {/* Lỗi từ server */}
          {createOrder.isError && (
            <div
              style={{
                padding: '0.75rem',
                background: 'var(--bg-danger-tint)',
                border: '1px solid var(--fg-danger)',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.9rem',
                color: 'var(--fg-danger)',
              }}
            >
              <OrderErrorMessage error={createOrder.error} nameOf={nameOf} />
            </div>
          )}

          <button
            type="submit"
            disabled={createOrder.isPending}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: createOrder.isPending ? 'var(--bg-surface-pressed)' : 'var(--bg-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: createOrder.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {createOrder.isPending ? 'Đang xử lý...' : `Xác nhận đặt hàng — ${formatVnd(total)}`}
          </button>
        </form>

        {/* ─── Tóm tắt đơn ───────────────────────────────── */}
        <div>
          <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>
            Đơn hàng ({selectedItems.length} sản phẩm)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {selectedItems.map((item) => (
              <div
                key={item.productId}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}
              >
                <span style={{ flex: 1, marginRight: '1rem' }}>
                  {item.name} <span style={{ color: 'var(--fg-subdued)' }}>× {item.quantity}</span>
                </span>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {formatVnd(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <hr style={{ margin: '1rem 0' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
              marginBottom: '0.5rem',
            }}
          >
            <span>Phí vận chuyển</span>
            <span style={{ color: 'var(--fg-success)' }}>Miễn phí</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 'bold',
              fontSize: '1.1rem',
            }}
          >
            <span>Tổng cộng</span>
            <span className="tabular">{formatVnd(total)}</span>
          </div>
          <p style={{ color: 'var(--fg-subdued)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Thanh toán khi nhận hàng (COD), đúng số tiền trên, không phát sinh thêm.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Thông báo lỗi đặt hàng theo mã nghiệp vụ (ordering.md "Trường hợp đặc biệt") */
function OrderErrorMessage({
  error,
  nameOf,
}: {
  error: unknown;
  nameOf: (productId: string) => string;
}) {
  if (!(error instanceof ApiError)) {
    return <>Không kết nối được máy chủ. Bấm đặt hàng lại sẽ không tạo đơn trùng.</>;
  }

  switch (error.code) {
    case 'OUT_OF_STOCK':
      return (
        <>
          Một số sản phẩm không đủ hàng. Vui lòng quay lại giỏ để điều chỉnh:
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {error.invalidItems.map((i) => (
              <li key={i.productId}>
                {nameOf(i.productId)}:{' '}
                {i.available > 0 ? `chỉ còn ${i.available}` : 'hết hàng hoặc ngừng bán'}
              </li>
            ))}
          </ul>
        </>
      );
    case 'PRICE_CHANGED':
      return (
        <>
          Giá đã thay đổi. Tóm tắt đơn bên cạnh đã cập nhật giá mới, vui lòng kiểm tra rồi bấm xác
          nhận lại:
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {error.changedItems.map((c) => (
              <li key={c.productId}>
                {nameOf(c.productId)}: {formatVnd(c.expectedPrice)} → {formatVnd(c.currentPrice)}
              </li>
            ))}
          </ul>
        </>
      );
    case 'ORDER_IN_PROGRESS':
      return (
        <>
          Đơn của bạn đang được xử lý. Vui lòng đợi vài giây rồi bấm lại; bạn sẽ không bị đặt trùng.
        </>
      );
    default:
      return <>{error.detail ?? error.title}</>;
  }
}
