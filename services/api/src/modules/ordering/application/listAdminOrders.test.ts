import { describe, expect, it, vi } from 'vitest';
import { InvalidOrderCursorError } from '../domain/errors.js';
import { encodeOrderCursor } from '../domain/history.js';
import type { OrderSummary } from '../domain/order.js';
import { listAdminOrders, type ListAdminOrdersDeps } from './listAdminOrders.js';

const SUMMARY: OrderSummary = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  status: 'CONFIRMED',
  totalAmount: 15_900_000,
  itemCount: 1,
  createdAt: '2026-10-25T03:00:00.000Z',
};

function deps(page: { orders: OrderSummary[]; hasMore: boolean }) {
  return {
    admin: { listByStatus: vi.fn(async () => page) },
  } satisfies ListAdminOrdersDeps;
}

describe('listAdminOrders', () => {
  it('listAdminOrders_returnsSummariesWithNextCursor_whenMorePages', async () => {
    // Arrange
    const d = deps({ orders: [SUMMARY], hasMore: true });

    // Act
    const result = await listAdminOrders(d, { status: 'CONFIRMED', limit: 1 });

    // Assert
    expect(result).toEqual({ items: [SUMMARY], nextCursor: encodeOrderCursor(SUMMARY.orderId) });
    // Verify
    expect(d.admin.listByStatus).toHaveBeenCalledWith('CONFIRMED', {
      limit: 1,
      beforeOrderId: undefined,
    });
  });

  it('listAdminOrders_dropsAnyExtraField_soAddressNeverLeaks', async () => {
    // Arrange: adapter lỡ trả thêm địa chỉ, userId (vd. ai đó bỏ ProjectionExpression)
    const leaky = {
      ...SUMMARY,
      userId: 'user-1',
      shippingAddress: { fullName: 'A', phone: '0912345678', address: 'x', province: 'y' },
    };
    const d = deps({ orders: [leaky], hasMore: false });

    // Act
    const result = await listAdminOrders(d, { status: 'CONFIRMED' });

    // Assert: chỉ còn đúng 5 trường của tóm tắt
    expect(result).toEqual({ items: [SUMMARY] });
    expect(JSON.stringify(result)).not.toMatch(/shippingAddress|userId|phone/);
  });

  it('listAdminOrders_passesDecodedCursorAndDefaultLimit', async () => {
    // Arrange
    const d = deps({ orders: [], hasMore: false });

    // Act
    await listAdminOrders(d, { status: 'SHIPPED', cursor: encodeOrderCursor(SUMMARY.orderId) });

    // Verify
    expect(d.admin.listByStatus).toHaveBeenCalledWith('SHIPPED', {
      limit: 20,
      beforeOrderId: SUMMARY.orderId,
    });
  });

  it('listAdminOrders_throwsInvalidCursor_beforeReadingTable', async () => {
    // Arrange
    const d = deps({ orders: [], hasMore: false });

    // Act, Assert
    await expect(
      listAdminOrders(d, { status: 'SHIPPED', cursor: 'khong-phai-cursor' }),
    ).rejects.toBeInstanceOf(InvalidOrderCursorError);
    // Verify
    expect(d.admin.listByStatus).not.toHaveBeenCalled();
  });
});
