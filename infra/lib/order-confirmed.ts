import { Duration, Tags, Validations } from 'aws-cdk-lib';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

/**
 * Tin "đơn đã xác nhận" (ordering.md, luồng SQS bước 2.3; nhóm chốt 17/10 và 21/10/2026).
 * Worker `order-processor` của `ordering` gửi tin vào topic; module `events` nhận qua hàng đợi riêng
 * có DLQ rồi ghi `PURCHASE`, nên `ordering` không ghi thẳng bảng `events` (ADR-0009).
 *
 * Nội dung tin: `{ orderId, userId, confirmedAt, items: [{ productId, quantity }] }`, không có
 * `shippingAddress` (threat model O8). Ai được gửi, ai được nhận: threat model E9.
 */
export class OrderConfirmed extends Construct {
  /** Topic `order-confirmed`; `order-processor` cần `topic.grantPublish(fn)` và biến môi trường chứa ARN. */
  public readonly topic: Topic;
  /** Hàng đợi của `events`; consumer gắn bằng `SqsEventSource` với `reportBatchItemFailures`. */
  public readonly eventsQueue: Queue;
  /** Tin xử lý lỗi 5 lần dồn vào đây, giữ 14 ngày để xem lại và gửi lại. */
  public readonly eventsDeadLetterQueue: Queue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.topic = new Topic(this, 'Topic', {
      displayName: 'shop order-confirmed',
      // Từ chối mọi lời gọi tới topic không qua HTTPS
      enforceSSL: true,
    });

    this.eventsDeadLetterQueue = new Queue(this, 'EventsDeadLetterQueue', {
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
    });
    this.eventsQueue = new Queue(this, 'EventsQueue', {
      // SSE-SQS: SNS gửi vào được ngay; khoá KMS aws/sqs thì SNS không dùng được
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      // Lớn hơn 6 lần timeout của consumer (5 giây) theo khuyến nghị cho Lambda đọc SQS
      visibilityTimeout: Duration.seconds(30),
      deadLetterQueue: { queue: this.eventsDeadLetterQueue, maxReceiveCount: 5 },
    });

    // Tin nguyên bản (không bọc envelope SNS); queue policy chỉ nhận từ đúng topic này (aws:SourceArn, E9)
    this.topic.addSubscription(new SqsSubscription(this.eventsQueue, { rawMessageDelivery: true }));

    Tags.of(this.topic).add('module', 'ordering');
    Tags.of(this.eventsQueue).add('module', 'events');
    Tags.of(this.eventsDeadLetterQueue).add('module', 'events');

    Validations.of(this.eventsDeadLetterQueue).acknowledge({
      id: 'AwsSolutions-SQS3',
      reason: 'Đây chính là DLQ của hàng đợi events; DLQ không cần DLQ của riêng nó.',
    });
  }
}
