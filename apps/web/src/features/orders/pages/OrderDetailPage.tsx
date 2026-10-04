import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import { CUSTOMER_CANCELLABLE, STATUS_LABEL, type Order } from '../types';
import { formatVnd } from '../../../shared/lib/format';

// Trang đích sau khi đặt hàng; có nút huỷ đơn theo ordering.md BR-10
export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const justCreated = Boolean(location.state?.justCreated);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.detail(orderId!),
    queryFn: () => api.get<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
  });

  const cancelOrder = useMutation({
    mutationFn: () => api.delete<Order>(`/orders/${orderId}`),
    onSuccess: (order) => {
      // Ghi thẳng kết quả vào cache chi tiết, làm mới danh sách đơn
      queryClient.setQueryData(queryKeys.orders.detail(orderId!), order);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
    },
    // Đơn có thể vừa chuyển SHIPPED ở phía admin → tải lại để hiện đúng trạng thái
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId!) }),
  });

  if (isLoading) return <p>Đang tải đơn hàng...</p>;
  // 404 cũng là kết quả khi xem đơn của người khác (không lộ là đơn có tồn tại)
  if (error instanceof ApiError && error.status === 404) return <p>Không tìm thấy đơn hàng.</p>;
  if (error || !data) return <p>Không thể tải đơn hàng.</p>;

  return (
    <div style={{ maxWidth: '800px' }}>
      {justCreated && (
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--bg-success-tint)',
            border: '1px solid transparent',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          Đặt hàng thành công! Email xác nhận sẽ được gửi trong ít phút.
        </div>
      )}
      <h1>Đơn {data.orderId}</h1>
      <p>
        Trạng thái: <strong>{STATUS_LABEL[data.status]}</strong>
      </p>
      <ul>
        {data.items.map((i) => (
          <li key={i.productId}>
            {i.name} × {i.quantity} — {formatVnd(i.price * i.quantity)}
          </li>
        ))}
      </ul>
      <p style={{ fontWeight: 'bold' }}>
        Tổng: {formatVnd(data.totalAmount)} (COD, miễn phí vận chuyển)
      </p>
      <p>
        Giao tới: {data.shippingAddress.fullName}, {data.shippingAddress.phone},{' '}
        {data.shippingAddress.address}, {data.shippingAddress.province}
      </p>
      {CUSTOMER_CANCELLABLE.includes(data.status) && (
        <button
          onClick={() => cancelOrder.mutate()}
          disabled={cancelOrder.isPending}
          style={{ marginBottom: '1rem', color: 'var(--fg-danger)' }}
        >
          {cancelOrder.isPending ? 'Đang huỷ...' : 'Huỷ đơn'}
        </button>
      )}
      {cancelOrder.isError && (
        <p role="alert" style={{ color: 'var(--fg-danger)' }}>
          {cancelOrder.error instanceof ApiError && cancelOrder.error.code === 'CANNOT_CANCEL'
            ? 'Đơn đã được giao cho đơn vị vận chuyển nên không huỷ được nữa.'
            : 'Không huỷ được đơn, vui lòng thử lại.'}
        </p>
      )}
      <p>
        <Link to="/orders">← Tất cả đơn hàng</Link>
      </p>
    </div>
  );
}
