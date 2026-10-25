import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import type { OrderConfirmedMessage, RecordPurchaseResult } from './application/recordPurchase.js';
import { makePurchaseHandler } from './purchaseHandler.js';

const MESSAGE: OrderConfirmedMessage = {
  orderId: 'order-1',
  userId: 'user-sub-1',
  confirmedAt: '2026-10-21T08:45:00Z',
  items: [{ productId: 'gpu-1', quantity: 1 }],
};

function record(messageId: string, body: string): SQSRecord {
  return { messageId, body } as SQSRecord;
}

function sqs(...records: SQSRecord[]): SQSEvent {
  return { Records: records };
}

function useCases() {
  return {
    recordPurchase: vi
      .fn<(m: OrderConfirmedMessage) => Promise<RecordPurchaseResult>>()
      .mockResolvedValue({ written: 1, duplicates: 0 }),
  };
}

describe('makePurchaseHandler', () => {
  it('handler_recordsEachMessage_andReportsNoFailure', async () => {
    // Arrange
    const u = useCases();
    const second = { ...MESSAGE, orderId: 'order-2' };

    // Act
    const response = await makePurchaseHandler(u)(
      sqs(record('m1', JSON.stringify(MESSAGE)), record('m2', JSON.stringify(second))),
    );

    // Assert
    expect(response).toEqual({ batchItemFailures: [] });
    expect(u.recordPurchase).toHaveBeenCalledTimes(2);
    expect(u.recordPurchase).toHaveBeenCalledWith(MESSAGE);
  });

  it('handler_reportsOnlyMalformedMessage_andDoesNotRecordIt', async () => {
    // Arrange
    const u = useCases();

    // Act
    const response = await makePurchaseHandler(u)(
      sqs(
        record('bad-json', '{not json'),
        record('bad-schema', JSON.stringify({ orderId: 'order-3' })),
        record('ok', JSON.stringify(MESSAGE)),
      ),
    );

    // Assert: tin hỏng vào DLQ sau 5 lần, tin đúng vẫn ghi
    expect(response.batchItemFailures).toEqual([
      { itemIdentifier: 'bad-json' },
      { itemIdentifier: 'bad-schema' },
    ]);
    expect(u.recordPurchase).toHaveBeenCalledTimes(1);
  });

  it('handler_reportsMessage_whenWriteFails_soSqsRetriesIt', async () => {
    // Arrange
    const u = useCases();
    u.recordPurchase.mockRejectedValueOnce(new Error('DynamoDB lỗi'));

    // Act
    const response = await makePurchaseHandler(u)(
      sqs(record('m1', JSON.stringify(MESSAGE)), record('m2', JSON.stringify(MESSAGE))),
    );

    // Assert
    expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'm1' }]);
    expect(u.recordPurchase).toHaveBeenCalledTimes(2);
  });
});
