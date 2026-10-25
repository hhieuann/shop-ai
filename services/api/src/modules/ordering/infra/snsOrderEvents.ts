import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import type { OrderConfirmedEvent } from '../domain/notification.js';
import type { OrderEvents } from '../ports.js';

/**
 * Gửi tin `order-confirmed` lên topic SNS (infra/lib/order-confirmed.ts). Hàng đợi events nhận tin
 * nguyên bản (raw message delivery), nên Message là đúng JSON của tin, không bọc thêm.
 */
export class SnsOrderEvents implements OrderEvents {
  constructor(
    private readonly sns: SNSClient,
    private readonly topicArn: string,
  ) {}

  async publishConfirmed(event: OrderConfirmedEvent): Promise<void> {
    await this.sns.send(
      new PublishCommand({ TopicArn: this.topicArn, Message: JSON.stringify(event) }),
    );
  }
}
