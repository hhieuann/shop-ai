import { describe, expect, it, vi } from 'vitest';
import { logger } from '../../../shared/logger.js';
import type { OrderMessage } from '../ports.js';
import { notifyWorker, type NotifyWorkerDeps } from './notifyWorker.js';

const MESSAGE: OrderMessage = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  type: 'CANCELLED',
  correlationId: 'corr-1',
};

function deps(enqueue: () => Promise<void> = async () => {}) {
  return {
    queue: { enqueue: vi.fn(enqueue) },
    metrics: { enqueueFailed: vi.fn() },
  } satisfies NotifyWorkerDeps;
}

describe('notifyWorker', () => {
  it('notifyWorker_sendsMessage_withoutMetric_whenQueueAccepts', async () => {
    // Arrange
    const d = deps();

    // Act
    await notifyWorker(d, MESSAGE);

    // Verify
    expect(d.queue.enqueue).toHaveBeenCalledExactlyOnceWith(MESSAGE);
    expect(d.metrics.enqueueFailed).not.toHaveBeenCalled();
  });

  it('notifyWorker_logsAndCountsMetric_withoutThrowing_whenQueueFails', async () => {
    // Arrange
    const d = deps(async () => {
      throw new Error('SQS không phản hồi');
    });
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    // Act
    const act = notifyWorker(d, MESSAGE);

    // Assert: đơn đã ghi nên request không hỏng
    await expect(act).resolves.toBeUndefined();

    // Verify: log chỉ có mã đơn, loại tin, correlationId
    expect(d.metrics.enqueueFailed).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'Không gửi được tin đơn hàng cho worker',
      expect.objectContaining({
        orderId: MESSAGE.orderId,
        type: 'CANCELLED',
        correlationId: 'corr-1',
      }),
    );
    error.mockRestore();
  });
});
