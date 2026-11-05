import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import { useRequireSignIn } from '../../../shared/auth/useRequireSignIn';
import { STATUS_LABEL, type OrderSummary } from '../types';
import { formatVnd } from '../../../shared/lib/format';

// Bản tối thiểu để link /orders không còn ra 404; phân trang (nextCursor) làm ở tuần 4
export function OrderListPage() {
  // Chưa đăng nhập thì sang /login như /checkout, không gọi API rồi hiện lỗi (#316)
  const session = useRequireSignIn();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: () => api.get<{ items: OrderSummary[]; nextCursor?: string }>('/orders'),
    enabled: session === 'signedIn',
  });

  if (session !== 'signedIn' || isLoading) return <p>Đang tải đơn hàng...</p>;
  if (isError) return <p>Không thể tải đơn hàng.</p>;

  const orders = data?.items ?? [];

  return (
    <div style={{ maxWidth: '860px' }}>
      <h1>Đơn hàng của tôi</h1>
      {orders.length === 0 ? (
        <p>
          Bạn chưa có đơn nào. <Link to="/products">Mua sắm ngay</Link>
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {orders.map((o) => (
            <li
              key={o.orderId}
              style={{
                border: '1px solid var(--border-divider)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '0.5rem',
              }}
            >
              <Link to={`/orders/${o.orderId}`}>Đơn {o.orderId}</Link>
              <span style={{ marginLeft: '1rem' }}>{STATUS_LABEL[o.status]}</span>
              <span style={{ float: 'right', fontWeight: 'bold' }}>{formatVnd(o.totalAmount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
