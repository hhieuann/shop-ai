import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { OrderMessage, OrderQueue } from '../ports.js';

/**
 * Gửi tin cho worker order-processor qua hàng đợi đơn (ordering.md, luồng SQS).
 * Tin chỉ có mã đơn, mã người dùng, loại và correlationId; không có địa chỉ, SĐT (threat model O8).
 * Worker đọc lại đơn từ bảng orders, không tin nội dung tin ngoài orderId (O9).
 */
export class SqsOrderQueue implements OrderQueue {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueue(message: OrderMessage): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          correlationId: { DataType: 'String', StringValue: message.correlationId },
        },
      }),
    );
  }
}
