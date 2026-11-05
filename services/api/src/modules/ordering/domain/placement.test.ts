import { describe, expect, it } from 'vitest';
import type { RequestedItem, ShippingAddress } from './order.js';
import {
  markerExpiresAt,
  MARKER_TTL_SECONDS,
  payloadHash,
  remainingCartLines,
} from './placement.js';

const ADDRESS: ShippingAddress = {
  fullName: 'Nguyễn Văn A',
  phone: '0912345678',
  address: '12 Nguyễn Huệ, phường Bến Nghé',
  province: 'TP. Hồ Chí Minh',
};

const GPU: RequestedItem = { productId: 'gpu-1', quantity: 1, expectedPrice: 15_900_000 };
const PSU: RequestedItem = { productId: 'psu-1', quantity: 2, expectedPrice: 2_000_000 };

describe('payloadHash', () => {
  it('payloadHash_isSame_whenItemOrderDiffers', () => {
    // Act
    const a = payloadHash([GPU, PSU], ADDRESS);
    const b = payloadHash([PSU, GPU], ADDRESS);

    // Assert
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('payloadHash_differs_whenQuantityPriceOrAddressDiffers', () => {
    // Arrange
    const base = payloadHash([GPU], ADDRESS);

    // Act
    const others = [
      payloadHash([{ ...GPU, quantity: 2 }], ADDRESS),
      payloadHash([{ ...GPU, expectedPrice: 1 }], ADDRESS),
      payloadHash([GPU], { ...ADDRESS, phone: '0987654321' }),
    ];

    // Assert
    for (const other of others) expect(other).not.toBe(base);
  });
});

describe('markerExpiresAt', () => {
  it('markerExpiresAt_isTwentyFourHoursLater_inEpochSeconds', () => {
    // Act
    const expiresAt = markerExpiresAt('2026-10-24T03:00:00.000Z');

    // Assert
    expect(expiresAt).toBe(Date.parse('2026-10-24T03:00:00.000Z') / 1000 + MARKER_TTL_SECONDS);
  });
});

describe('remainingCartLines', () => {
  it('remainingCartLines_dropsWholeOrderedLines_andKeepsOthersInOrder', () => {
    // Arrange: giỏ có GPU × 3 nhưng chỉ đặt GPU × 1 → vẫn bỏ cả dòng (BR-09)
    const lines = [
      { productId: 'gpu-1', quantity: 3 },
      { productId: 'bag-1', quantity: 1 },
      { productId: 'psu-1', quantity: 2 },
      { productId: 'mouse-1', quantity: 1 },
    ];

    // Act
    const remaining = remainingCartLines(lines, ['gpu-1', 'psu-1']);

    // Assert
    expect(remaining).toEqual([
      { productId: 'bag-1', quantity: 1 },
      { productId: 'mouse-1', quantity: 1 },
    ]);
  });
});
