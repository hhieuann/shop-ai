import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { logger } from '../../shared/logger.js';
import {
  orderConfirmedSchema,
  type OrderConfirmedMessage,
  type RecordPurchaseResult,
} from './application/recordPurchase.js';

export interface PurchaseUseCases {
  readonly recordPurchase: (message: OrderConfirmedMessage) => Promise<RecordPurchaseResult>;
}

/**
 * Nhận tin `order-confirmed` từ hàng đợi SQS của events (raw message delivery, không có envelope SNS).
 * Mỗi tin xử lý riêng; tin lỗi được báo trong `batchItemFailures` để SQS giao lại đúng tin đó,
 * sau 5 lần thì vào DLQ (infra/lib/order-confirmed.ts). Tin hỏng (không phải JSON, sai schema)
 * cũng báo lỗi thay vì bỏ qua, để còn xem lại trong DLQ; không ghi gì cho tin đó.
 * Không log `userId`, `userIdHash` hay nội dung tin (events.md mục 5); chỉ log `messageId`, `orderId`.
 */
export function makePurchaseHandler(useCases: PurchaseUseCases) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

    for (const record of event.Records) {
      const messageId = record.messageId;
      const message = parse(record.body);
      if (!message) {
        logger.warn('Tin order-confirmed không đúng định dạng, để SQS chuyển vào DLQ', {
          messageId,
        });
        batchItemFailures.push({ itemIdentifier: messageId });
        continue;
      }

      try {
        const result = await useCases.recordPurchase(message);
        logger.info('Đã ghi PURCHASE', { messageId, orderId: message.orderId, ...result });
      } catch (error) {
        logger.error('Không ghi được PURCHASE, SQS sẽ giao lại', {
          error,
          messageId,
          orderId: message.orderId,
        });
        batchItemFailures.push({ itemIdentifier: messageId });
      }
    }

    return { batchItemFailures };
  };
}

function parse(body: string): OrderConfirmedMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const result = orderConfirmedSchema.safeParse(json);
  return result.success ? result.data : null;
}
