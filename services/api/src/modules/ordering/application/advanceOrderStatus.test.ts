import { describe, expect, it, vi } from 'vitest';
import { AdminOrderNotFoundError, InvalidStatusTransitionError } from '../domain/errors.js';
import type { Order, OrderStatus } from '../domain/order.js';
import type { AdminOrderRecord } from '../ports.js';
import { advanceOrderStatus, type AdvanceOrderStatusDeps } from './advanceOrderStatus.js';

const NOW = '2026-11-06T08:00:00.000Z';
const ORDER_ID = '01K8GQ5Z3XM2T9V4B6N8P0R2S4';

const RECORD: AdminOrderRecord = {
  orderId: ORDER_ID,
  userId: 'user-1',
  status: 'CONFIRMED',
  totalAmount: 15_900_000,
  itemCount: 1,
  firstItemName: 'ASUS TUF RTX 4070',
  createdAt: '2026-10-25T03:00:00.000Z',
};

/** Đơn trên bảng chính lúc đọc lại: khách vừa huỷ */
const CANCELLED_ORDER: Order = {
  orderId: ORDER_ID,
  userId: 'user-1',
  status: 'CANCELLED',
  items: [{ productId: 'gpu-1', name: 'ASUS TUF RTX 4070', price: 15_900_000, quantity: 1 }],
  totalAmount: 15_900_000,
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

/** Index giả: đơn đang nằm ở phân vùng `indexedAs` (null: không có ở đâu) */
function deps(
  options: {
    indexedAs?: OrderStatus | null;
    result?: 'advanced' | 'statusChanged';
    current?: Order | null;
  } = {},
) {
  const indexedAs = options.indexedAs === undefined ? 'CONFIRMED' : options.indexedAs;
  const current = options.current === undefined ? CANCELLED_ORDER : options.current;
  return {
    admin: {
      findInStatus: vi.fn(async (status: OrderStatus) =>
        status === indexedAs ? { ...RECORD, status } : null,
      ),
      advance: vi.fn(async () => options.result ?? ('advanced' as const)),
    },
    orders: { get: vi.fn(async () => current) },
    now: () => NOW,
  } satisfies AdvanceOrderStatusDeps;
}

const INPUT = { adminId: 'admin-1', orderId: ORDER_ID } as const;

describe('advanceOrderStatus', () => {
  it('advanceOrderStatus_shipsConfirmedOrder_andReturnsSummaryWithoutAddress', async () => {
    // Arrange
    const d = deps();

    // Act
    const result = await advanceOrderStatus(d, { ...INPUT, to: 'SHIPPED' });

    // Assert
    expect(result).toEqual({
      orderId: ORDER_ID,
      status: 'SHIPPED',
      totalAmount: RECORD.totalAmount,
      itemCount: 1,
      createdAt: RECORD.createdAt,
    });
    expect(JSON.stringify(result)).not.toMatch(/shippingAddress|userId|firstItemName/);
    // Verify: tìm ở trạng thái liền trước, ghi có điều kiện từ trạng thái đó
    expect(d.admin.findInStatus).toHaveBeenCalledTimes(1);
    expect(d.admin.findInStatus).toHaveBeenCalledWith('CONFIRMED', ORDER_ID);
    expect(d.admin.advance).toHaveBeenCalledWith({
      userId: 'user-1',
      orderId: ORDER_ID,
      from: 'CONFIRMED',
      to: 'SHIPPED',
      now: NOW,
    });
  });

  it('advanceOrderStatus_deliversShippedOrder', async () => {
    // Arrange
    const d = deps({ indexedAs: 'SHIPPED' });

    // Act
    const result = await advanceOrderStatus(d, { ...INPUT, to: 'DELIVERED' });

    // Assert
    expect(result.status).toBe('DELIVERED');
    // Verify
    expect(d.admin.advance).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'SHIPPED', to: 'DELIVERED' }),
    );
  });

  it.each<[OrderStatus, 'SHIPPED' | 'DELIVERED']>([
    ['PENDING', 'SHIPPED'],
    ['DELIVERED', 'SHIPPED'],
    ['CANCELLED', 'SHIPPED'],
    ['CONFIRMED', 'DELIVERED'],
    ['DELIVERED', 'DELIVERED'],
  ])('advanceOrderStatus_throws409WithCurrentStatus_whenOrderIs%s_to%s', async (status, to) => {
    // Arrange
    const d = deps({ indexedAs: status });

    // Act
    const error = await advanceOrderStatus(d, { ...INPUT, to }).catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(InvalidStatusTransitionError);
    expect((error as InvalidStatusTransitionError).extensions).toEqual({ currentStatus: status });
    // Verify: không ghi gì
    expect(d.admin.advance).not.toHaveBeenCalled();
  });

  it('advanceOrderStatus_throws404_whenOrderNowhereInIndex', async () => {
    // Arrange
    const d = deps({ indexedAs: null });

    // Act, Assert
    await expect(advanceOrderStatus(d, { ...INPUT, to: 'SHIPPED' })).rejects.toBeInstanceOf(
      AdminOrderNotFoundError,
    );
    // Verify: tìm ở trạng thái liền trước rồi 4 trạng thái còn lại
    expect(d.admin.findInStatus).toHaveBeenCalledTimes(5);
    expect(d.admin.advance).not.toHaveBeenCalled();
  });

  it('advanceOrderStatus_throws404_withoutReading_whenOrderIdMalformed', async () => {
    // Arrange
    const d = deps();

    // Act, Assert
    await expect(
      advanceOrderStatus(d, { ...INPUT, orderId: 'khong-phai-ulid', to: 'SHIPPED' }),
    ).rejects.toBeInstanceOf(AdminOrderNotFoundError);
    // Verify
    expect(d.admin.findInStatus).not.toHaveBeenCalled();
  });

  it('advanceOrderStatus_throws409WithRealStatus_whenStatusChangedSinceIndexRead', async () => {
    // Arrange: index còn CONFIRMED nhưng khách vừa huỷ; điều kiện ghi chặn lại
    const d = deps({ result: 'statusChanged' });

    // Act
    const error = await advanceOrderStatus(d, { ...INPUT, to: 'SHIPPED' }).catch((e: unknown) => e);

    // Assert: báo trạng thái thật đọc từ bảng chính
    expect(error).toBeInstanceOf(InvalidStatusTransitionError);
    expect((error as InvalidStatusTransitionError).extensions).toEqual({
      currentStatus: 'CANCELLED',
    });
    // Verify
    expect(d.orders.get).toHaveBeenCalledWith('user-1', ORDER_ID);
  });
});
