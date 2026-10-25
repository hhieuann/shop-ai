import { describe, expect, it, vi } from 'vitest';
import { logger } from '../../../shared/logger.js';
import type { Order } from '../domain/order.js';
import type { SendEmailResult } from '../ports.js';
import { sendOrderEmail, type SendOrderEmailDeps } from './sendOrderEmail.js';

const ORDER: Order = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  status: 'CONFIRMED',
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
  updatedAt: '2026-10-25T03:00:05.000Z',
};

const CUSTOMER_EMAIL = 'khach@example.com';

function deps(options: { email?: string | null; result?: SendEmailResult } = {}) {
  return {
    customers: {
      emailOf: vi.fn(async () => (options.email === undefined ? CUSTOMER_EMAIL : options.email)),
    },
    mailer: { send: vi.fn(async () => options.result ?? ({ status: 'sent' } as const)) },
    metrics: { emailRejected: vi.fn() },
  } satisfies SendOrderEmailDeps;
}

describe('sendOrderEmail', () => {
  it('sendOrderEmail_sendsConfirmationToOwner_whenEmailFound', async () => {
    // Arrange
    const d = deps();

    // Act
    const result = await sendOrderEmail(d, ORDER, 'CONFIRMED');

    // Assert
    expect(result).toEqual({ status: 'sent' });

    // Verify: tra email theo userId của đơn, gửi đúng tiêu đề
    expect(d.customers.emailOf).toHaveBeenCalledExactlyOnceWith('user-1');
    expect(d.mailer.send).toHaveBeenCalledExactlyOnceWith(
      CUSTOMER_EMAIL,
      expect.objectContaining({ subject: `Black Magic: đã xác nhận đơn ${ORDER.orderId}` }),
    );
    expect(d.metrics.emailRejected).not.toHaveBeenCalled();
  });

  it('sendOrderEmail_rejectsWithoutSending_whenNoEmailInCognito', async () => {
    // Arrange
    const d = deps({ email: null });

    // Act
    const result = await sendOrderEmail(d, ORDER, 'CANCELLED');

    // Assert
    expect(result).toEqual({ status: 'rejected', reason: 'no_recipient' });

    // Verify
    expect(d.mailer.send).not.toHaveBeenCalled();
    expect(d.metrics.emailRejected).toHaveBeenCalledExactlyOnceWith('no_recipient');
  });

  it('sendOrderEmail_logsWarnWithoutAddress_andCountsMetric_whenSesRejects', async () => {
    // Arrange: sandbox, địa chỉ chưa xác minh (vd. người dùng E2E)
    const d = deps({ result: { status: 'rejected', reason: 'not_verified' } });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    // Act
    const result = await sendOrderEmail(d, ORDER, 'CONFIRMED');

    // Assert: không ném, nên tin không vào DLQ
    expect(result).toEqual({ status: 'rejected', reason: 'not_verified' });

    // Verify: log mức warn, không có địa chỉ email (O8)
    expect(d.metrics.emailRejected).toHaveBeenCalledExactlyOnceWith('not_verified');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain(CUSTOMER_EMAIL);
    warn.mockRestore();
  });

  it('sendOrderEmail_throws_whenSesFailsTemporarily', async () => {
    // Arrange
    const d = deps();
    d.mailer.send.mockRejectedValue(new Error('SES không phản hồi'));

    // Act
    const act = sendOrderEmail(d, ORDER, 'CONFIRMED');

    // Assert: để SQS giao lại tin
    await expect(act).rejects.toThrow('SES không phản hồi');

    // Verify
    expect(d.metrics.emailRejected).not.toHaveBeenCalled();
  });
});
