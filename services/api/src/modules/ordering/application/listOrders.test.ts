import { describe, expect, it, vi } from 'vitest';
import { InvalidOrderCursorError } from '../domain/errors.js';
import { decodeOrderCursor, DEFAULT_PAGE_SIZE, encodeOrderCursor } from '../domain/history.js';
import type { OrderSummary } from '../domain/order.js';
import type { OrderHistoryPage } from '../ports.js';
import { listOrders, type ListOrdersDeps } from './listOrders.js';

const NEWER: OrderSummary = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S6',
  status: 'PENDING',
  totalAmount: 15_900_000,
  itemCount: 1,
  createdAt: '2026-10-25T03:00:00.000Z',
};
const OLDER: OrderSummary = { ...NEWER, orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4' };

function deps(page: OrderHistoryPage = { orders: [NEWER, OLDER], hasMore: false }) {
  return { history: { listByUser: vi.fn(async () => page) } } satisfies ListOrdersDeps;
}

describe('listOrders', () => {
  it('listOrders_returnsFirstPageWithDefaultLimit_whenNoCursor', async () => {
    // Arrange
    const d = deps();

    // Act
    const result = await listOrders(d, { userId: 'user-1' });

    // Assert: hết đơn thì không có nextCursor
    expect(result).toEqual({ items: [NEWER, OLDER] });

    // Verify
    expect(d.history.listByUser).toHaveBeenCalledExactlyOnceWith('user-1', {
      limit: DEFAULT_PAGE_SIZE,
      afterOrderId: undefined,
    });
  });

  it('listOrders_returnsCursorOfLastOrder_whenMoreOrdersRemain', async () => {
    // Arrange
    const d = deps({ orders: [NEWER, OLDER], hasMore: true });

    // Act
    const result = await listOrders(d, { userId: 'user-1', limit: 2 });

    // Assert
    expect(result.items).toEqual([NEWER, OLDER]);
    expect(decodeOrderCursor(result.nextCursor ?? '')).toBe(OLDER.orderId);
  });

  it('listOrders_readsAfterCursorOrder_whenCursorGiven', async () => {
    // Arrange
    const d = deps({ orders: [OLDER], hasMore: false });

    // Act
    await listOrders(d, { userId: 'user-1', limit: 1, cursor: encodeOrderCursor(NEWER.orderId) });

    // Verify: userId lấy từ input (token), cursor chỉ mang orderId
    expect(d.history.listByUser).toHaveBeenCalledExactlyOnceWith('user-1', {
      limit: 1,
      afterOrderId: NEWER.orderId,
    });
  });

  it('listOrders_returnsEmptyWithoutCursor_whenNoOrders', async () => {
    // Arrange
    const d = deps({ orders: [], hasMore: false });

    // Act
    const result = await listOrders(d, { userId: 'user-1' });

    // Assert
    expect(result).toEqual({ items: [] });
  });

  it('listOrders_throwsInvalidCursor_andDoesNotReadTable_whenCursorBroken', async () => {
    // Arrange
    const d = deps();

    // Act
    const act = listOrders(d, { userId: 'user-1', cursor: 'abc' });

    // Assert
    await expect(act).rejects.toBeInstanceOf(InvalidOrderCursorError);

    // Verify
    expect(d.history.listByUser).not.toHaveBeenCalled();
  });
});
