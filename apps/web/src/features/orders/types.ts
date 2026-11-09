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

/** ordering.md BR-10: khách tự huỷ được khi đơn chưa giao cho vận chuyển */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'CONFIRMED'];
