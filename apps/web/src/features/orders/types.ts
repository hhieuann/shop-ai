import type { OrderStatus } from '../../shared/api/types';
import type { BadgeTone } from '../../shared/components/Badge';

export type { Order, OrderListResponse, OrderStatus, OrderSummary } from '../../shared/api/types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
};

/** Màu nhãn trạng thái đơn (design-system §9.7) */
export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: 'neutral',
  CONFIRMED: 'primary',
  SHIPPED: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

/** Ô ghi chú dưới thanh trạng thái ở trang chi tiết đơn (pages/don-hang.md mục 4.1); đơn huỷ không có */
export const STATUS_NOTE: Record<Exclude<OrderStatus, 'CANCELLED'>, string> = {
  PENDING:
    'Hệ thống đang xác nhận đơn, thường chỉ mất vài giây. Email xác nhận sẽ được gửi khi đơn được xác nhận.',
  CONFIRMED:
    'Đơn đã được xác nhận và đang chờ giao cho đơn vị vận chuyển. Bạn vẫn huỷ được đơn ở bước này.',
  SHIPPED:
    'Đơn đã giao cho đơn vị vận chuyển. Shipper sẽ gọi số điện thoại bên dưới trước khi giao.',
  DELIVERED: 'Đơn đã giao thành công.',
};

/** ordering.md BR-10: khách tự huỷ được khi đơn chưa giao cho vận chuyển */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'CONFIRMED'];
