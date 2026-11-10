import { Badge } from '../../../shared/components/Badge';
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from '../types';

/** Nhãn trạng thái đơn (design-system §9.7): chữ `STATUS_LABEL`, màu `STATUS_TONE` */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
