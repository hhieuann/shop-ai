import { describe, expect, it, vi } from 'vitest';
import type { StoredEvent } from '../domain/event.js';
import {
  orderConfirmedSchema,
  recordPurchase,
  type OrderConfirmedMessage,
  type RecordPurchaseDeps,
} from './recordPurchase.js';

const MESSAGE: OrderConfirmedMessage = {
  orderId: '01JBORDER0000000000000000A',
  userId: 'user-sub-1',
  confirmedAt: '2026-10-21T08:45:00Z',
  items: [
    { productId: 'gpu-1', quantity: 1 },
    { productId: 'psu-1', quantity: 2 },
  ],
};

function deps(putOnce = vi.fn<(e: StoredEvent) => Promise<boolean>>().mockResolvedValue(true)) {
  return {
    putOnce,
    deps: {
      events: { putOnce },
      hasher: { hash: vi.fn().mockResolvedValue('hash-of-user') },
    } satisfies RecordPurchaseDeps,
  };
}

describe('recordPurchase', () => {
  it('recordPurchase_writesOnePurchasePerProduct_atConfirmedAt_withOrderAndQuantity', async () => {
    // Arrange
    const { putOnce, deps: d } = deps();

    // Act
    const result = await recordPurchase(d, MESSAGE);

    // Assert
    expect(result).toEqual({ written: 2, duplicates: 0 });
    expect(putOnce).toHaveBeenNthCalledWith(1, {
      userIdHash: 'hash-of-user',
      eventId: '01JBORDER0000000000000000A#gpu-1',
      productId: 'gpu-1',
      eventType: 'PURCHASE',
      timestamp: '2026-10-21T08:45:00.000Z',
      ttl: Date.parse('2026-10-21T08:45:00Z') / 1000 + 90 * 24 * 60 * 60,
      orderId: '01JBORDER0000000000000000A',
      quantity: 1,
    });
    expect(putOnce.mock.calls[1]?.[0]).toMatchObject({ productId: 'psu-1', quantity: 2 });
    expect(JSON.stringify(putOnce.mock.calls)).not.toContain('user-sub-1');
  });

  it('recordPurchase_hashesUserOnce_perMessage', async () => {
    // Arrange
    const { deps: d } = deps();

    // Act
    await recordPurchase(d, MESSAGE);

    // Assert
    expect(d.hasher.hash).toHaveBeenCalledTimes(1);
    expect(d.hasher.hash).toHaveBeenCalledWith('user-sub-1');
  });

  it('recordPurchase_sumsQuantity_whenSameProductAppearsTwice', async () => {
    // Arrange
    const { putOnce, deps: d } = deps();

    // Act
    await recordPurchase(d, {
      ...MESSAGE,
      items: [
        { productId: 'ram-1', quantity: 1 },
        { productId: 'ram-1', quantity: 3 },
      ],
    });

    // Assert
    expect(putOnce).toHaveBeenCalledTimes(1);
    expect(putOnce.mock.calls[0]?.[0]).toMatchObject({ productId: 'ram-1', quantity: 4 });
  });

  it('recordPurchase_countsDuplicates_whenMessageIsDeliveredAgain', async () => {
    // Arrange: lần giao thứ hai, cả hai dòng đã có
    const { deps: d } = deps(
      vi.fn<(e: StoredEvent) => Promise<boolean>>().mockResolvedValue(false),
    );

    // Act
    const result = await recordPurchase(d, MESSAGE);

    // Assert
    expect(result).toEqual({ written: 0, duplicates: 2 });
  });

  it('recordPurchase_doesNotWrite_whenHasherFails', async () => {
    // Arrange
    const { putOnce, deps: d } = deps();
    d.hasher.hash.mockRejectedValue(new Error('SSM lỗi'));

    // Act + Assert
    await expect(recordPurchase(d, MESSAGE)).rejects.toThrow('SSM lỗi');
    expect(putOnce).not.toHaveBeenCalled();
  });
});

describe('orderConfirmedSchema', () => {
  it('orderConfirmedSchema_acceptsMessage_andIgnoresExtraFields', () => {
    // Act
    const result = orderConfirmedSchema.safeParse({ ...MESSAGE, total: 123 });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('total');
  });

  it.each([
    ['không có items', { ...MESSAGE, items: [] }],
    ['số lượng 0', { ...MESSAGE, items: [{ productId: 'gpu-1', quantity: 0 }] }],
    ['số lượng lẻ', { ...MESSAGE, items: [{ productId: 'gpu-1', quantity: 1.5 }] }],
    ['thiếu userId', { ...MESSAGE, userId: '' }],
    ['confirmedAt không phải ISO 8601', { ...MESSAGE, confirmedAt: '21/10/2026' }],
  ])('orderConfirmedSchema_rejects_%s', (_name, message) => {
    // Act + Assert
    expect(orderConfirmedSchema.safeParse(message).success).toBe(false);
  });
});
