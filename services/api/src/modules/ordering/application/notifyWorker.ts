import { logger } from '../../../shared/logger.js';
import type { OrderMessage, OrderMetrics, OrderQueue } from '../ports.js';

export interface NotifyWorkerDeps {
  readonly queue: OrderQueue;
  readonly metrics: OrderMetrics;
}

/**
 * Gửi tin cho worker order-processor sau khi giao dịch đã ghi (đặt đơn, huỷ đơn).
 * Gửi lỗi không làm hỏng request: đơn đã ghi, khách không phải làm lại (ordering.md, luồng SQS bước 1);
 * ghi log và metric OrderEnqueueFailed để xử lý theo runbook.
 */
export async function notifyWorker(deps: NotifyWorkerDeps, message: OrderMessage): Promise<void> {
  try {
    await deps.queue.enqueue(message);
  } catch (error) {
    // Chỉ ghi mã đơn, loại tin và correlationId, không ghi địa chỉ, SĐT (O8)
    logger.error('Không gửi được tin đơn hàng cho worker', {
      error,
      orderId: message.orderId,
      type: message.type,
      correlationId: message.correlationId,
    });
    deps.metrics.enqueueFailed();
  }
}
