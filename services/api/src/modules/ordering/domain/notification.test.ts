import { describe, expect, it } from 'vitest';
import { formatVnd, orderConfirmedEvent, orderEmail } from './notification.js';
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

describe('orderEmail', () => {
  it('orderEmail_listsItemsTotalAndCod_whenConfirmed', () => {
    // Act
    const email = orderEmail(ORDER, 'CONFIRMED');

    // Assert
    expect(email.subject).toBe(`Black Magic: đã xác nhận đơn ${ORDER.orderId}`);
    expect(email.text).toContain('- ASUS TUF RTX 4070 × 1');
    expect(email.text).toContain('- Nguồn 750W × 2');
    expect(email.text).toContain('19.900.000 ₫');
    expect(email.text).toContain('Thanh toán khi nhận hàng (COD), miễn phí vận chuyển');
    expect(email.html).toContain('<li>Nguồn 750W × 2</li>');
  });

  it('orderEmail_saysNoPaymentDue_whenCancelled', () => {
    // Act
    const email = orderEmail(ORDER, 'CANCELLED');

    // Assert
    expect(email.subject).toBe(`Black Magic: đã huỷ đơn ${ORDER.orderId}`);
    expect(email.text).toContain(`Đơn ${ORDER.orderId} đã được huỷ.`);
    expect(email.text).toContain('Bạn không phải thanh toán');
  });

  it.each(['CONFIRMED', 'CANCELLED'] as const)('orderEmail_hasNoPersonalDataOrLink_%s', (kind) => {
    // Act
    const email = JSON.stringify(orderEmail(ORDER, kind));

    // Assert: thư đi qua hộp thư bên ngoài; khách xem đủ thông tin ở trang đơn
    const { fullName, phone, address } = ORDER.shippingAddress;
    for (const leaked of [fullName, phone, address, ORDER.userId, 'http']) {
      expect(email).not.toContain(leaked);
    }
  });

  it('orderEmail_escapesHtml_inProductName', () => {
    // Arrange
    const order = { ...ORDER, items: [{ ...ORDER.items[0]!, name: 'Cáp <b>USB</b> & "C"' }] };

    // Act
    const email = orderEmail(order, 'CONFIRMED');

    // Assert
    expect(email.html).toContain('Cáp &lt;b&gt;USB&lt;/b&gt; &amp; &quot;C&quot;');
    expect(email.text).toContain('Cáp <b>USB</b> & "C"');
  });

  it('formatVnd_groupsThousandsWithDots', () => {
    // Act
    const text = formatVnd(31_800_000);

    // Assert
    expect(text).toBe('31.800.000 ₫');
  });
});
