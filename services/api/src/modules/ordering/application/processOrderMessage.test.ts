import { describe, expect, it, vi } from 'vitest';
import type { Order, OrderStatus } from '../domain/order.js';
import type { SendEmailResult } from '../ports.js';
import {
  MAX_CONFIRM_ATTEMPTS,
  processOrderMessage,
  type OrderMessageInput,
  type ProcessOrderMessageDeps,
} from './processOrderMessage.js';

const NOW = '2026-10-25T09:00:00.000Z';

const ORDER: Order = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  status: 'PENDING',
  items: [{ productId: 'gpu-1', name: 'ASUS TUF RTX 4070', price: 15_900_000, quantity: 2 }],
  totalAmount: 31_800_000,
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

const PLACED: OrderMessageInput = {
  orderId: ORDER.orderId,
  userId: 'user-1',
  type: 'PLACED',
  correlationId: 'corr-1',
};

function withStatus(status: OrderStatus, updatedAt = ORDER.updatedAt): Order {
  return { ...ORDER, status, updatedAt };
}

function deps(
  options: { reads?: (Order | null)[]; results?: ('confirmed' | 'notPending')[] } = {},
) {
  const reads = [...(options.reads ?? [ORDER])];
  const results = [...(options.results ?? ['confirmed'])];
  const d = {
    orders: {
      // Mỗi lần đọc lấy phần tử tiếp theo; hết thì giữ phần tử cuối
      get: vi.fn(async () => (reads.length > 1 ? reads.shift() : reads[0]) ?? null),
      confirm: vi.fn(
        async () => (results.length > 1 ? results.shift() : results[0]) ?? 'confirmed',
      ),
    },
    events: { publishConfirmed: vi.fn(async () => {}) },
    now: () => NOW,
  };
  return d satisfies ProcessOrderMessageDeps;
}

describe('processOrderMessage', () => {
  it('processOrderMessage_confirmsAndPublishes_whenPending', async () => {
    // Arrange
    const d = deps();

    // Act
    const outcome = await processOrderMessage(d, PLACED);

    // Assert
    expect(outcome).toBe('confirmed');

    // Verify: đọc theo khoá trong tin, xác nhận đúng đơn đã đọc, tin có confirmedAt = giờ xác nhận
    expect(d.orders.get).toHaveBeenCalledExactlyOnceWith('user-1', ORDER.orderId);
    expect(d.orders.confirm).toHaveBeenCalledExactlyOnceWith({ order: ORDER, now: NOW });
    expect(d.events.publishConfirmed).toHaveBeenCalledExactlyOnceWith({
      orderId: ORDER.orderId,
      userId: 'user-1',
      confirmedAt: NOW,
      items: [{ productId: 'gpu-1', quantity: 2 }],
    });
  });

  it('processOrderMessage_republishesWithSameConfirmedAt_whenAlreadyConfirmed', async () => {
    // Arrange: lần giao trước đã xác nhận lúc 03:00:05
    const d = deps({ reads: [withStatus('CONFIRMED', '2026-10-25T03:00:05.000Z')] });

    // Act
    const outcome = await processOrderMessage(d, PLACED);

    // Assert
    expect(outcome).toBe('republished');

    // Verify
    expect(d.orders.confirm).not.toHaveBeenCalled();
    expect(d.events.publishConfirmed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ confirmedAt: '2026-10-25T03:00:05.000Z' }),
    );
  });

  it.each([
    ['CANCELLED', 'skippedCancelled'],
    ['SHIPPED', 'skippedPastConfirmed'],
    ['DELIVERED', 'skippedPastConfirmed'],
  ] as const)('processOrderMessage_doesNothing_when%s', async (status, expected) => {
    // Arrange
    const d = deps({ reads: [withStatus(status)] });

    // Act
    const outcome = await processOrderMessage(d, PLACED);

    // Assert
    expect(outcome).toBe(expected);

    // Verify
    expect(d.orders.confirm).not.toHaveBeenCalled();
    expect(d.events.publishConfirmed).not.toHaveBeenCalled();
  });

  it('processOrderMessage_skips_whenOrderNotFound', async () => {
    // Arrange: tin giả hoặc userId bị sửa (O9)
    const d = deps({ reads: [null] });

    // Act
    const outcome = await processOrderMessage(d, PLACED);

    // Assert
    expect(outcome).toBe('skippedNotFound');

    // Verify
    expect(d.events.publishConfirmed).not.toHaveBeenCalled();
  });

  it('processOrderMessage_skips_whenCustomerCancelledWhileConfirming', async () => {
    // Arrange: đọc PENDING, lúc ghi khách đã huỷ
    const d = deps({ reads: [ORDER, withStatus('CANCELLED')], results: ['notPending'] });

    // Act
    const outcome = await processOrderMessage(d, PLACED);

    // Assert
    expect(outcome).toBe('skippedCancelled');

    // Verify
    expect(d.orders.confirm).toHaveBeenCalledTimes(1);
    expect(d.events.publishConfirmed).not.toHaveBeenCalled();
  });

  it('processOrderMessage_throws_whenStatusKeepsChanging', async () => {
    // Arrange
    const d = deps({ results: ['notPending'] });

    // Act
    const act = processOrderMessage(d, PLACED);

    // Assert: ném để SQS giao lại tin sau
    await expect(act).rejects.toThrow();

    // Verify
    expect(d.orders.confirm).toHaveBeenCalledTimes(MAX_CONFIRM_ATTEMPTS);
  });

  it('processOrderMessage_throws_whenPublishFails', async () => {
    // Arrange
    const d = deps();
    d.events.publishConfirmed.mockRejectedValue(new Error('SNS không phản hồi'));

    // Act
    const act = processOrderMessage(d, PLACED);

    // Assert: đơn đã xác nhận; lần giao lại thấy CONFIRMED và gửi lại tin
    await expect(act).rejects.toThrow('SNS không phản hồi');
  });

  it('processOrderMessage_notesCancelledMessage_withoutReadingOrder_whenEmailDisabled', async () => {
    // Arrange: Lambda thiếu cấu hình thư (emailConfig), không có sendEmail
    const d = deps();

    // Act
    const outcome = await processOrderMessage(d, { ...PLACED, type: 'CANCELLED' });

    // Assert
    expect(outcome).toBe('cancelNoted');

    // Verify
    expect(d.orders.get).not.toHaveBeenCalled();
    expect(d.events.publishConfirmed).not.toHaveBeenCalled();
  });

  it('processOrderMessage_confirmsPublishesThenEmails_inThatOrder', async () => {
    // Arrange
    const d = withEmail(deps());

    // Act
    const outcome = await processOrderMessage(d, PLACED);

    // Assert
    expect(outcome).toBe('confirmed');

    // Verify: thư sau tin order-confirmed (thư lỗi không chặn PURCHASE), đơn đã CONFIRMED
    expect(d.sendEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: 'CONFIRMED', updatedAt: NOW }),
      'CONFIRMED',
    );
    expect(d.events.publishConfirmed.mock.invocationCallOrder[0]).toBeLessThan(
      d.sendEmail.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('processOrderMessage_emailsAgain_whenRedeliveredAfterConfirm', async () => {
    // Arrange: lần trước xác nhận xong nhưng gửi thư lỗi; chống trùng do idempotency ở lambda
    const d = withEmail(deps({ reads: [withStatus('CONFIRMED')] }));

    // Act
    await processOrderMessage(d, PLACED);

    // Verify
    expect(d.sendEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: 'CONFIRMED' }),
      'CONFIRMED',
    );
  });

  it('processOrderMessage_keepsOutcome_whenEmailRejected', async () => {
    // Arrange: SES từ chối (vd. người dùng E2E chưa xác minh)
    const d = withEmail(deps(), { status: 'rejected', reason: 'not_verified' });

    // Act
    const outcome = await processOrderMessage(d, PLACED);

    // Assert: không ném, tin không vào DLQ
    expect(outcome).toBe('confirmed');
  });

  it('processOrderMessage_throws_whenEmailFailsTemporarily', async () => {
    // Arrange
    const d = withEmail(deps());
    d.sendEmail.mockRejectedValue(new Error('SES không phản hồi'));

    // Act
    const act = processOrderMessage(d, PLACED);

    // Assert: SQS giao lại; lần sau đơn đã CONFIRMED nên chỉ gửi lại tin và thư
    await expect(act).rejects.toThrow('SES không phản hồi');
  });

  it.each([
    ['sent', 'cancelEmailSent'],
    ['rejected', 'cancelEmailRejected'],
  ] as const)(
    'processOrderMessage_emailsCancellation_whenOrderCancelled (%s)',
    async (status, expected) => {
      // Arrange
      const result =
        status === 'sent'
          ? ({ status: 'sent' } as const)
          : ({ status: 'rejected', reason: 'not_verified' } as const);
      const d = withEmail(deps({ reads: [withStatus('CANCELLED')] }), result);

      // Act
      const outcome = await processOrderMessage(d, { ...PLACED, type: 'CANCELLED' });

      // Assert
      expect(outcome).toBe(expected);

      // Verify: không gửi tin order-confirmed khi huỷ
      expect(d.sendEmail).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ status: 'CANCELLED' }),
        'CANCELLED',
      );
      expect(d.events.publishConfirmed).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['đơn không còn CANCELLED', withStatus('CONFIRMED'), 'skippedNotCancelled'],
    ['không có đơn', null, 'skippedNotFound'],
  ] as const)(
    'processOrderMessage_skipsCancellationEmail_when%s',
    async (_label, read, expected) => {
      // Arrange
      const d = withEmail(deps({ reads: [read] }));

      // Act
      const outcome = await processOrderMessage(d, { ...PLACED, type: 'CANCELLED' });

      // Assert
      expect(outcome).toBe(expected);

      // Verify
      expect(d.sendEmail).not.toHaveBeenCalled();
    },
  );

  it('processOrderMessage_doesNotEmail_whenCancelledBeforeConfirm', async () => {
    // Arrange: tin PLACED tới khi đơn đã huỷ (ordering.md mục 5)
    const d = withEmail(deps({ reads: [withStatus('CANCELLED')] }));

    // Act
    await processOrderMessage(d, PLACED);

    // Verify: thư huỷ đi theo tin CANCELLED riêng, không theo tin PLACED
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
});

/** Thêm bước gửi thư vào deps, mặc định gửi được */
function withEmail<D extends ReturnType<typeof deps>>(
  d: D,
  result: SendEmailResult = { status: 'sent' },
) {
  const sendEmail = vi.fn<NonNullable<ProcessOrderMessageDeps['sendEmail']>>(async () => result);
  return { ...d, sendEmail } satisfies ProcessOrderMessageDeps;
}
