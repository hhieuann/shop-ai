import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { logger } from '../../shared/logger.js';
import type { OrderMessageInput } from './application/processOrderMessage.js';
import { makeProcessorHandler, type ProcessorUseCases } from './processorHandler.js';

const MESSAGE: OrderMessageInput = {
  orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  userId: 'user-1',
  type: 'PLACED',
  correlationId: 'corr-1',
};

function record(messageId: string, body: unknown): SQSRecord {
  return {
    messageId,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  } as SQSRecord;
}

function sqsEvent(...records: SQSRecord[]): SQSEvent {
  return { Records: records };
}

function useCases() {
  return {
    processOrderMessage: vi.fn().mockResolvedValue('confirmed'),
  } satisfies ProcessorUseCases;
}

describe('order-processor handler', () => {
  it('handler_returnsNoFailures_whenAllMessagesProcessed', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeProcessorHandler(cases);

    // Act
    const res = await handler(sqsEvent(record('m1', MESSAGE), record('m2', MESSAGE)));

    // Assert
    expect(res).toEqual({ batchItemFailures: [] });

    // Verify
    expect(cases.processOrderMessage).toHaveBeenCalledTimes(2);
    expect(cases.processOrderMessage).toHaveBeenCalledWith(MESSAGE);
  });

  it('handler_reportsOnlyFailedMessage_whenOneOfThreeFails', async () => {
    // Arrange
    const cases = useCases();
    cases.processOrderMessage
      .mockResolvedValueOnce('confirmed')
      .mockRejectedValueOnce(new Error('DynamoDB không phản hồi'))
      .mockResolvedValueOnce('confirmed');
    const handler = makeProcessorHandler(cases);

    // Act
    const res = await handler(
      sqsEvent(record('m1', MESSAGE), record('m2', MESSAGE), record('m3', MESSAGE)),
    );

    // Assert: SQS chỉ giao lại tin m2 (partial batch failure)
    expect(res).toEqual({ batchItemFailures: [{ itemIdentifier: 'm2' }] });
  });

  it.each([
    ['không phải JSON', '{oops'],
    ['thiếu orderId', { ...MESSAGE, orderId: undefined }],
    ['type lạ', { ...MESSAGE, type: 'SHIPPED' }],
  ])('handler_reportsFailure_withoutProcessing_whenMessage%s', async (_label, body) => {
    // Arrange
    const cases = useCases();
    const handler = makeProcessorHandler(cases);

    // Act
    const res = await handler(sqsEvent(record('bad', body)));

    // Assert: tin hỏng để SQS chuyển vào DLQ, còn xem lại được
    expect(res).toEqual({ batchItemFailures: [{ itemIdentifier: 'bad' }] });

    // Verify
    expect(cases.processOrderMessage).not.toHaveBeenCalled();
  });

  it('handler_doesNotRetry_whenOrderNotFound', async () => {
    // Arrange
    const cases = useCases();
    cases.processOrderMessage.mockResolvedValue('skippedNotFound');
    const handler = makeProcessorHandler(cases);

    // Act
    const res = await handler(sqsEvent(record('m1', MESSAGE)));

    // Assert
    expect(res).toEqual({ batchItemFailures: [] });
  });

  it('handler_logsOnlyKeys_withoutPersonalData', async () => {
    // Arrange
    const cases = useCases();
    cases.processOrderMessage.mockRejectedValue(new Error('SNS không phản hồi'));
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const handler = makeProcessorHandler(cases);

    // Act
    await handler(sqsEvent(record('m1', MESSAGE)));

    // Verify: log có messageId, orderId, correlationId; không có userId (O8)
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'Không xử lý được tin đơn hàng, SQS sẽ giao lại',
      expect.objectContaining({
        messageId: 'm1',
        orderId: MESSAGE.orderId,
        correlationId: 'corr-1',
      }),
    );
    expect(JSON.stringify(error.mock.calls[0]?.[1])).not.toContain('user-1');
    error.mockRestore();
  });
});
