import type { Order } from './order.js';

/**
 * Tin `order-confirmed` gửi lên SNS cho module events ghi PURCHASE (ordering.md bước 2.3).
 * Không có địa chỉ, họ tên, SĐT, giá, tên sản phẩm (threat model O8).
 */
export interface OrderConfirmedEvent {
  readonly orderId: string;
  readonly userId: string;
  readonly confirmedAt: string;
  readonly items: readonly { readonly productId: string; readonly quantity: number }[];
}

/** Thư gửi khách qua SES: tiêu đề và hai bản nội dung (chữ thường, HTML) */
export interface EmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Loại thư: xác nhận đơn (ordering.md 2.2) hoặc báo huỷ (BR-13); cũng là phần sau của khoá chống trùng */
export type EmailKind = 'CONFIRMED' | 'CANCELLED';

const VND = new Intl.NumberFormat('vi-VN');

/** 31800000 → "31.800.000 ₫" */
export function formatVnd(amount: number): string {
  return `${VND.format(amount)} ₫`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const VIEW_ORDER = 'Xem đơn ở mục Đơn hàng trên web Black Magic.';

/**
 * Thư báo khách. Chỉ có mã đơn, món, tổng tiền, cách thanh toán: không có họ tên, địa chỉ, SĐT, userId
 * (thư đi qua hộp thư bên ngoài; khách xem đủ thông tin ở trang đơn). Không có link trực tiếp tới đơn:
 * URL web nằm ở stack web, đưa vào Lambda của stack api thì thành vòng phụ thuộc giữa hai stack.
 */
export function orderEmail(order: Order, kind: EmailKind): EmailContent {
  const total = formatVnd(order.totalAmount);
  if (kind === 'CANCELLED') {
    const lines = [
      `Đơn ${order.orderId} đã được huỷ.`,
      `Tổng tiền đơn: ${total}. Bạn không phải thanh toán khoản này.`,
      VIEW_ORDER,
    ];
    return {
      subject: `Black Magic: đã huỷ đơn ${order.orderId}`,
      text: ['Xin chào,', '', ...lines].join('\n'),
      html: `<p>Xin chào,</p>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}`,
    };
  }

  const items = order.items.map((item) => `${item.name} × ${item.quantity}`);
  const intro = `Đơn ${order.orderId} đã được xác nhận.`;
  const payment = `Tổng tiền: ${total}. Thanh toán khi nhận hàng (COD), miễn phí vận chuyển.`;
  return {
    subject: `Black Magic: đã xác nhận đơn ${order.orderId}`,
    text: [
      'Xin chào,',
      '',
      intro,
      '',
      ...items.map((item) => `- ${item}`),
      '',
      payment,
      VIEW_ORDER,
    ].join('\n'),
    html:
      `<p>Xin chào,</p><p>${escapeHtml(intro)}</p>` +
      `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` +
      `<p>${escapeHtml(payment)}</p><p>${escapeHtml(VIEW_ORDER)}</p>`,
  };
}

/**
 * Dựng tin từ đơn đã `CONFIRMED`. `confirmedAt` là `updatedAt` lúc chuyển trạng thái, nên lần gửi lại
 * (SQS giao lại tin) có cùng thời điểm; consumer events ghi PURCHASE theo thời điểm này.
 */
export function orderConfirmedEvent(order: Order): OrderConfirmedEvent {
  return {
    orderId: order.orderId,
    userId: order.userId,
    confirmedAt: order.updatedAt,
    items: order.items.map(({ productId, quantity }) => ({ productId, quantity })),
  };
}
