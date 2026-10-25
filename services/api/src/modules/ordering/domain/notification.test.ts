import { describe, expect, it } from 'vitest';
import { orderConfirmedEvent } from './notification.js';
import type { Order } from './order.js';

const ORDER: Order = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  status: 'CONFIRMED',
  items: [
    { productId: 'gpu-1', name: 'ASUS TUF RTX 4070', price: 15_900_000, quantity: 1 },
    { productId: 'psu-1', name: 'Nguồn 750W', price: 2_000_000, quantity: 2 },
  ],
  totalAmount: 19_900_000,
  shippingFee: 0,
  shippingAddress: {
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    address: '12 Nguyễn Huệ, phường Bến Nghé',
    province: 'TP. Hồ Chí Minh',
  },
  paymentMethod: 'COD',
  createdAt: '2026-10-25T03:00:00.000Z',
  updatedAt: '2026-10-25T03:00:05.000Z',
};

describe('orderConfirmedEvent', () => {
  it('orderConfirmedEvent_usesUpdatedAtAsConfirmedAt_andKeepsOnlyProductAndQuantity', () => {
    // Act
    const event = orderConfirmedEvent(ORDER);

    // Assert
    expect(event).toEqual({
      orderId: ORDER.orderId,
      userId: 'user-1',
      confirmedAt: '2026-10-25T03:00:05.000Z',
      items: [
        { productId: 'gpu-1', quantity: 1 },
        { productId: 'psu-1', quantity: 2 },
      ],
    });
  });

  it('orderConfirmedEvent_hasNoPersonalDataOrPrice', () => {
    // Act
    const json = JSON.stringify(orderConfirmedEvent(ORDER));

    // Assert: threat model O8
    for (const leaked of ['shippingAddress', ORDER.shippingAddress.phone, 'price', 'name']) {
      expect(json).not.toContain(leaked);
    }
  });
});
