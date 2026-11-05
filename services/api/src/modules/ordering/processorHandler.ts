import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { logger } from '../../shared/logger.js';
import {
  orderMessageSchema,
  type OrderMessageInput,
  type ProcessOrderOutcome,
} from './application/processOrderMessage.js';

export interface ProcessorUseCases {
  readonly processOrderMessage: (message: OrderMessageInput) => Promise<ProcessOrderOutcome>;
}

/**
 * Worker order-processor: nhận tin từ hàng đợi đơn (ordering.md, luồng SQS).
 * Mỗi tin xử lý riêng; tin lỗi báo trong `batchItemFailures` để SQS giao lại đúng tin đó, quá 3 lần
 * thì vào DLQ (runbook dlq-orders.md). Tin hỏng (không phải JSON, sai schema) cũng báo lỗi để còn xem
 * lại trong DLQ. Log chỉ có `messageId`, `orderId`, `correlationId`, không có email, địa chỉ (O8).
 */
export function makeProcessorHandler(useCases: ProcessorUseCases) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

    for (const record of event.Records) {
      const messageId = record.messageId;
      const message = parse(record.body);
      if (!message) {
        logger.warn('Tin đơn hàng không đúng định dạng, để SQS chuyển vào DLQ', { messageId });
        batchItemFailures.push({ itemIdentifier: messageId });
        continue;
      }

      const keys = { messageId, orderId: message.orderId, correlationId: message.correlationId };
      try {
        const outcome = await useCases.processOrderMessage(message);
        if (outcome === 'skippedNotFound') {
          // Không có đơn với khoá trong tin: tin giả hoặc bị sửa (O9); không giao lại
          logger.warn('Không tìm thấy đơn của tin, bỏ qua', keys);
        } else {
          logger.info('Đã xử lý tin đơn hàng', { ...keys, type: message.type, outcome });
        }
      } catch (error) {
        logger.error('Không xử lý được tin đơn hàng, SQS sẽ giao lại', { ...keys, error });
        batchItemFailures.push({ itemIdentifier: messageId });
      }
    }

    return { batchItemFailures };
  };
}

function parse(body: string): OrderMessageInput | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const result = orderMessageSchema.safeParse(json);
  return result.success ? result.data : null;
}
