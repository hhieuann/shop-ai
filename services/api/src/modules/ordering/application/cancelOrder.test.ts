import { describe, expect, it, vi } from 'vitest';
import { CannotCancelError, OrderNotFoundError } from '../domain/errors.js';
import type { Order, OrderStatus } from '../domain/order.js';
import { cancelOrder, MAX_CANCEL_ATTEMPTS, type CancelOrderDeps } from './cancelOrder.js';

const NOW = '2026-10-25T08:00:00.000Z';

const ORDER: Order = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  status: 'PENDING',
  items: [{ productId: 'gpu-1', name: 'ASUS TUF RTX 4070', price: 15_900_000, quantity: 3 }],
  totalAmount: 47_700_000,
  shippingFee: 0,
  shippingAddress: {
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    address: '12 Nguyễn Huệ, phường Bến Nghé',
    province: 'TP. Hồ Chí Minh',
  },
  paymentMethod: 'COD',
  createdAt: '2026-10-25T03:00:00.000Z',
  updatedAt: '2026-10-25T03:00:00.000Z',
};

const INPUT = { userId: 'user-1', orderId: ORDER.orderId, correlationId: 'corr-1' };

function withStatus(status: OrderStatus): Order {
  return { ...ORDER, status };
}

function deps(
  options: {
    reads?: (Order | null)[];
    results?: ('cancelled' | 'statusChanged')[];
    enqueue?: () => Promise<void>;
  } = {},
) {
  const reads = [...(options.reads ?? [ORDER])];
  const results = [...(options.results ?? ['cancelled'])];
  const d = {
    orders: {
      // Mỗi lần đọc lấy phần tử tiếp theo; hết thì giữ phần tử cuối
      get: vi.fn(async () => (reads.length > 1 ? reads.shift()! : reads[0]!)),
      cancel: vi.fn(async () => (results.length > 1 ? results.shift()! : results[0]!)),
    },
    queue: { enqueue: vi.fn(options.enqueue ?? (async () => {})) },
    metrics: { enqueueFailed: vi.fn() },
    now: () => NOW,
  };
  return d satisfies CancelOrderDeps;
}

describe('cancelOrder', () => {
  it.each(['PENDING', 'CONFIRMED'] as const)(
    'cancelOrder_cancelsAndNotifiesWorker_when%s',
    async (status) => {
      // Arrange
      const order = withStatus(status);
      const d = deps({ reads: [order] });

      // Act
      const result = await cancelOrder(d, INPUT);

      // Assert
      expect(result).toEqual({ ...order, status: 'CANCELLED', updatedAt: NOW });

      // Verify: đọc theo userId của token, ghi đúng trạng thái đã đọc, tin không có dữ liệu cá nhân
      expect(d.orders.get).toHaveBeenCalledExactlyOnceWith('user-1', ORDER.orderId);
      expect(d.orders.cancel).toHaveBeenCalledExactlyOnceWith({ order, now: NOW });
      expect(d.queue.enqueue).toHaveBeenCalledExactlyOnceWith({
        orderId: ORDER.orderId,
        userId: 'user-1',
        type: 'CANCELLED',
        correlationId: 'corr-1',
      });
    },
  );

  it.each(['SHIPPED', 'DELIVERED', 'CANCELLED'] as const)(
    'cancelOrder_throwsCannotCancel_andWritesNothing_when%s',
    async (status) => {
      // Arrange
      const d = deps({ reads: [withStatus(status)] });

      // Act
      const act = cancelOrder(d, INPUT);

      // Assert: huỷ lần hai cũng rơi vào đây (đã CANCELLED), nên không hoàn kho thêm
      await expect(act).rejects.toBeInstanceOf(CannotCancelError);

      // Verify
      expect(d.orders.cancel).not.toHaveBeenCalled();
      expect(d.queue.enqueue).not.toHaveBeenCalled();
    },
  );

  it('cancelOrder_throwsNotFound_whenMissingOrSomeoneElses', async () => {
    // Arrange
    const d = deps({ reads: [null] });

    // Act
    const act = cancelOrder(d, INPUT);

    // Assert
    await expect(act).rejects.toBeInstanceOf(OrderNotFoundError);

    // Verify
    expect(d.orders.cancel).not.toHaveBeenCalled();
  });

  it.each(['#OPEN', '#KEY#abc', 'not-an-id'])(
    'cancelOrder_throwsNotFound_andDoesNotReadTable_whenOrderIdMalformed %s',
    async (orderId) => {
      // Arrange
      const d = deps();

      // Act
      const act = cancelOrder(d, { ...INPUT, orderId });

      // Assert
      await expect(act).rejects.toBeInstanceOf(OrderNotFoundError);

      // Verify
      expect(d.orders.get).not.toHaveBeenCalled();
    },
  );

  it('cancelOrder_retriesWithNewStatus_whenWorkerConfirmedMeanwhile', async () => {
    // Arrange: đọc PENDING, lúc ghi worker đã chuyển CONFIRMED
    const confirmed = withStatus('CONFIRMED');
    const d = deps({ reads: [ORDER, confirmed], results: ['statusChanged', 'cancelled'] });

    // Act
    const result = await cancelOrder(d, INPUT);

    // Assert
    expect(result.status).toBe('CANCELLED');

    // Verify: lần ghi thứ hai dùng trạng thái đọc lại
    expect(d.orders.cancel).toHaveBeenCalledTimes(2);
    expect(d.orders.cancel).toHaveBeenLastCalledWith({ order: confirmed, now: NOW });
  });

  it('cancelOrder_throwsCannotCancel_whenShippedMeanwhile', async () => {
    // Arrange
    const d = deps({ reads: [ORDER, withStatus('SHIPPED')], results: ['statusChanged'] });

    // Act
    const act = cancelOrder(d, INPUT);

    // Assert
    await expect(act).rejects.toBeInstanceOf(CannotCancelError);

    // Verify
    expect(d.orders.cancel).toHaveBeenCalledTimes(1);
    expect(d.queue.enqueue).not.toHaveBeenCalled();
  });

  it('cancelOrder_stopsAfterMaxAttempts_whenStatusKeepsChanging', async () => {
    // Arrange
    const d = deps({ results: ['statusChanged'] });

    // Act
    const act = cancelOrder(d, INPUT);

    // Assert
    await expect(act).rejects.toBeInstanceOf(CannotCancelError);

    // Verify
    expect(d.orders.cancel).toHaveBeenCalledTimes(MAX_CANCEL_ATTEMPTS);
  });

  it('cancelOrder_returnsCancelledOrder_andCountsMetric_whenQueueFails', async () => {
    // Arrange
    const d = deps({
      enqueue: async () => {
        throw new Error('SQS không phản hồi');
      },
    });

    // Act
    const result = await cancelOrder(d, INPUT);

    // Assert: giao dịch đã ghi, khách không phải huỷ lại
    expect(result.status).toBe('CANCELLED');

    // Verify
    expect(d.metrics.enqueueFailed).toHaveBeenCalledTimes(1);
  });
});
