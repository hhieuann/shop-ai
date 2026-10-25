import { describe, expect, it, vi } from 'vitest';
import { OrderNotFoundError } from '../domain/errors.js';
import type { Order } from '../domain/order.js';
import { getOrder, type GetOrderDeps } from './getOrder.js';

const ORDER: Order = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  status: 'PENDING',
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

function deps(found: Order | null = ORDER) {
  return { orders: { get: vi.fn(async () => found) } } satisfies GetOrderDeps;
}

describe('getOrder', () => {
  it('getOrder_returnsOrder_whenOwnedByUser', async () => {
    // Arrange
    const d = deps();

    // Act
    const result = await getOrder(d, { userId: 'user-1', orderId: ORDER.orderId });

    // Assert
    expect(result).toEqual(ORDER);

    // Verify: đọc theo userId của token
    expect(d.orders.get).toHaveBeenCalledExactlyOnceWith('user-1', ORDER.orderId);
  });

  it('getOrder_throwsNotFound_whenMissingOrOwnedBySomeoneElse', async () => {
    // Arrange: khoá gồm userId nên đơn của người khác đọc ra null như đơn không có
    const d = deps(null);

    // Act
    const act = getOrder(d, { userId: 'user-2', orderId: ORDER.orderId });

    // Assert
    await expect(act).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it.each(['#OPEN', '#KEY#abc', 'not-an-id', ''])(
    'getOrder_throwsNotFound_andDoesNotReadTable_whenOrderIdMalformed %s',
    async (orderId) => {
      // Arrange
      const d = deps();

      // Act
      const act = getOrder(d, { userId: 'user-1', orderId });

      // Assert
      await expect(act).rejects.toBeInstanceOf(OrderNotFoundError);

      // Verify
      expect(d.orders.get).not.toHaveBeenCalled();
    },
  );
});
