import { describe, expect, it, vi } from 'vitest';
import { logger } from '../../../shared/logger.js';
import { AdminCannotCancelError, AdminOrderNotFoundError } from '../domain/errors.js';
import { ORDER_STATUSES, type Order, type OrderStatus } from '../domain/order.js';
import type { AdminOrderRecord } from '../ports.js';
import { adminCancelOrder, type AdminCancelOrderDeps } from './adminCancelOrder.js';
import { MAX_CANCEL_ATTEMPTS } from './cancelOrder.js';

const NOW = '2026-11-16T08:00:00.000Z';

const ORDER: Order = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  status: 'CONFIRMED',
  items: [
    { productId: 'gpu-1', name: 'ASUS TUF RTX 4070', price: 15_900_000, quantity: 3 },
    { productId: 'psu-1', name: 'Corsair RM850e', price: 2_790_000, quantity: 1 },
  ],
  totalAmount: 50_490_000,
  shippingFee: 0,
  shippingAddress: {
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    address: '12 Nguyễn Huệ, phường Bến Nghé',
    province: 'TP. Hồ Chí Minh',
  },
  paymentMethod: 'COD',
  createdAt: '2026-11-16T03:00:00.000Z',
  updatedAt: '2026-11-16T03:00:00.000Z',
};

const INPUT = { adminId: 'admin-sub-1', orderId: ORDER.orderId, correlationId: 'corr-1' };

function withStatus(status: OrderStatus): Order {
  return { ...ORDER, status };
}

/** Bản ghi index `byStatus` của đơn (chỉ tóm tắt, kèm userId) */
function record(status: OrderStatus): AdminOrderRecord {
  return {
    orderId: ORDER.orderId,
    userId: ORDER.userId,
    status,
    totalAmount: ORDER.totalAmount,
    itemCount: ORDER.items.length,
    firstItemName: ORDER.items[0]!.name,
    createdAt: ORDER.createdAt,
  };
}

function deps(
  options: {
    /** Trạng thái đơn trong index `byStatus`; null khi index không có đơn */
    indexed?: OrderStatus | null;
    reads?: (Order | null)[];
    results?: ('cancelled' | 'statusChanged')[];
    enqueue?: () => Promise<void>;
  } = {},
) {
  const indexed = options.indexed === undefined ? ORDER.status : options.indexed;
  const reads = [...(options.reads ?? [ORDER])];
  const results = [...(options.results ?? ['cancelled'])];
  const d = {
    admin: {
      findInStatus: vi.fn(async (status: OrderStatus) =>
        indexed !== null && status === indexed ? record(indexed) : null,
      ),
    },
    orders: {
      // Mỗi lần đọc lấy phần tử tiếp theo; hết thì giữ phần tử cuối
      get: vi.fn(async () => (reads.length > 1 ? reads.shift()! : reads[0]!)),
      cancel: vi.fn(async () => (results.length > 1 ? results.shift()! : results[0]!)),
    },
    queue: { enqueue: vi.fn(options.enqueue ?? (async () => {})) },
    metrics: { enqueueFailed: vi.fn() },
    now: () => NOW,
  };
  return d satisfies AdminCancelOrderDeps;
}

describe('adminCancelOrder', () => {
  it.each(['PENDING', 'CONFIRMED', 'SHIPPED'] as const)(
    'adminCancelOrder_cancelsAndNotifiesWorker_when%s',
    async (status) => {
      // Arrange
      const order = withStatus(status);
      const d = deps({ indexed: status, reads: [order] });

      // Act
      const result = await adminCancelOrder(d, INPUT);

      // Assert: chỉ tóm tắt, không địa chỉ, không userId (O8)
      expect(result).toEqual({
        orderId: ORDER.orderId,
        status: 'CANCELLED',
        totalAmount: ORDER.totalAmount,
        itemCount: 2,
        createdAt: ORDER.createdAt,
      });

      // Verify: tra userId qua index ở mọi trạng thái, đọc mạnh theo userId đó, ghi đúng bản vừa đọc
      expect(d.admin.findInStatus).toHaveBeenCalledTimes(ORDER_STATUSES.length);
      for (const s of ORDER_STATUSES) {
        expect(d.admin.findInStatus).toHaveBeenCalledWith(s, ORDER.orderId);
      }
      expect(d.orders.get).toHaveBeenCalledExactlyOnceWith('user-1', ORDER.orderId);
      expect(d.orders.cancel).toHaveBeenCalledExactlyOnceWith({ order, now: NOW });
      expect(d.queue.enqueue).toHaveBeenCalledExactlyOnceWith({
        orderId: ORDER.orderId,
        userId: 'user-1',
        type: 'CANCELLED',
        correlationId: 'corr-1',
      });
      expect(d.metrics.enqueueFailed).not.toHaveBeenCalled();
    },
  );

  it.each(['DELIVERED', 'CANCELLED'] as const)(
    'adminCancelOrder_throwsCannotCancelWithCurrentStatus_when%s',
    async (status) => {
      // Arrange
      const d = deps({ indexed: status, reads: [withStatus(status)] });

      // Act
      const result = adminCancelOrder(d, INPUT);

      // Assert
      const error = await result.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AdminCannotCancelError);
      expect(error).toMatchObject({
        code: 'CANNOT_CANCEL',
        extensions: { currentStatus: status },
      });

      // Verify: không ghi gì, không gửi tin, không hoàn kho thêm
      expect(d.orders.cancel).not.toHaveBeenCalled();
      expect(d.queue.enqueue).not.toHaveBeenCalled();
    },
  );

  it('adminCancelOrder_decidesOnMainTable_whenIndexLags', async () => {
    // Arrange: index còn CONFIRMED nhưng bảng chính đã DELIVERED
    const d = deps({ indexed: 'CONFIRMED', reads: [withStatus('DELIVERED')] });

    // Act
    const error = await adminCancelOrder(d, INPUT).catch((e: unknown) => e);

    // Assert
    expect(error).toMatchObject({ extensions: { currentStatus: 'DELIVERED' } });
    // Verify
    expect(d.orders.cancel).not.toHaveBeenCalled();
  });

  it('adminCancelOrder_throwsNotFound_whenNoStatusHasOrder', async () => {
    // Arrange
    const d = deps({ indexed: null });

    // Act
    const result = adminCancelOrder(d, INPUT);

    // Assert
    await expect(result).rejects.toBeInstanceOf(AdminOrderNotFoundError);
    // Verify
    expect(d.orders.get).not.toHaveBeenCalled();
    expect(d.orders.cancel).not.toHaveBeenCalled();
  });

  it('adminCancelOrder_throwsNotFound_whenMainTableHasNoOrder', async () => {
    // Arrange: index còn bản ghi cũ, bảng chính không có
    const d = deps({ reads: [null] });

    // Act
    const result = adminCancelOrder(d, INPUT);

    // Assert
    await expect(result).rejects.toBeInstanceOf(AdminOrderNotFoundError);
    // Verify
    expect(d.orders.cancel).not.toHaveBeenCalled();
  });

  it('adminCancelOrder_throwsNotFound_withoutReading_whenOrderIdMalformed', async () => {
    // Arrange
    const d = deps();

    // Act
    const result = adminCancelOrder(d, { ...INPUT, orderId: 'not-an-order' });

    // Assert
    await expect(result).rejects.toBeInstanceOf(AdminOrderNotFoundError);
    // Verify
    expect(d.admin.findInStatus).not.toHaveBeenCalled();
    expect(d.orders.get).not.toHaveBeenCalled();
  });

  it('adminCancelOrder_rereadsAndRetries_whenStatusChangedBetweenReadAndWrite', async () => {
    // Arrange: lúc đọc CONFIRMED, worker hay admin khác vừa đổi sang SHIPPED; lần sau huỷ được
    const shipped = withStatus('SHIPPED');
    const d = deps({ reads: [ORDER, shipped], results: ['statusChanged', 'cancelled'] });

    // Act
    const result = await adminCancelOrder(d, INPUT);

    // Assert
    expect(result.status).toBe('CANCELLED');

    // Verify: lần ghi thứ hai dùng bản đọc lại (SHIPPED: giao dịch không giảm #OPEN)
    expect(d.orders.get).toHaveBeenCalledTimes(2);
    expect(d.orders.cancel).toHaveBeenNthCalledWith(2, { order: shipped, now: NOW });
    expect(d.queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('adminCancelOrder_throwsCannotCancel_whenStatusKeepsChanging', async () => {
    // Arrange: lần nào ghi cũng thấy trạng thái đã đổi; lần đọc cuối thấy CANCELLED
    const reads = [...Array<Order>(MAX_CANCEL_ATTEMPTS).fill(ORDER), withStatus('CANCELLED')];
    const d = deps({ reads, results: ['statusChanged'] });

    // Act
    const error = await adminCancelOrder(d, INPUT).catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(AdminCannotCancelError);
    expect(error).toMatchObject({ extensions: { currentStatus: 'CANCELLED' } });

    // Verify
    expect(d.orders.cancel).toHaveBeenCalledTimes(MAX_CANCEL_ATTEMPTS);
    expect(d.queue.enqueue).not.toHaveBeenCalled();
  });

  it('adminCancelOrder_returnsCancelled_andCountsFailure_whenEnqueueFails', async () => {
    // Arrange: giao dịch đã ghi, gửi tin cho worker lỗi
    const d = deps({ enqueue: async () => Promise.reject(new Error('SQS down')) });

    // Act
    const result = await adminCancelOrder(d, INPUT);

    // Assert: đơn đã huỷ thật nên vẫn trả thành công
    expect(result.status).toBe('CANCELLED');
    // Verify
    expect(d.metrics.enqueueFailed).toHaveBeenCalledTimes(1);
  });

  it('adminCancelOrder_logsAdminAndPreviousStatus_withoutAddress', async () => {
    // Arrange
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const d = deps();

    // Act
    await adminCancelOrder(d, INPUT);

    // Assert
    expect(info).toHaveBeenCalledWith('Admin huỷ đơn', {
      adminId: 'admin-sub-1',
      orderId: ORDER.orderId,
      from: 'CONFIRMED',
    });
    // Verify: không có địa chỉ, họ tên, SĐT trong log (O8)
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain(ORDER.shippingAddress.address);
    expect(logged).not.toContain(ORDER.shippingAddress.phone);
    info.mockRestore();
  });
});
