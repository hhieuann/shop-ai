import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { OrderConfirmed } from '../lib/order-confirmed.js';

/** Dựng OrderConfirmed trong một stack trống: test chỉ topic và hàng đợi, không cần cả ApiStack. */
function synth(): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { region: 'ap-southeast-1' } });
  new OrderConfirmed(stack, 'OrderConfirmed');
  return Template.fromStack(stack);
}

describe('OrderConfirmed', () => {
  it('topic_requiresTls', () => {
    // Act
    const template = synth();

    // Assert
    template.hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('eventsQueue_subscribesToTopicWithRawMessages', () => {
    // Act
    const template = synth();

    // Assert: consumer của events đọc thẳng JSON đơn hàng, không phải bóc envelope SNS
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'sqs',
      RawMessageDelivery: true,
    });
  });

  it('eventsQueue_acceptsMessagesOnlyFromTopic', () => {
    // Act
    const template = synth();

    // Assert: threat model E9, không ai gửi thẳng tin giả vào hàng đợi
    template.hasResourceProperties('AWS::SQS::QueuePolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: 'sqs:SendMessage',
            Principal: { Service: 'sns.amazonaws.com' },
            Condition: { ArnEquals: { 'aws:SourceArn': Match.anyValue() } },
          }),
        ]),
      },
    });
  });

  it('eventsQueue_movesMessageToDeadLetterQueueAfterFiveFailures', () => {
    // Act
    const template = synth();

    // Assert
    template.hasResourceProperties('AWS::SQS::Queue', {
      RedrivePolicy: { deadLetterTargetArn: Match.anyValue(), maxReceiveCount: 5 },
      VisibilityTimeout: 30,
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      MessageRetentionPeriod: 14 * 24 * 60 * 60,
    });
  });

  it('queues_areEncryptedWithSqsManagedKey', () => {
    // Act
    const template = synth();

    // Assert: SSE-SQS cho cả hàng đợi và DLQ, không tạo khoá KMS
    template.resourcePropertiesCountIs('AWS::SQS::Queue', { SqsManagedSseEnabled: true }, 2);
    template.resourceCountIs('AWS::KMS::Key', 0);
  });
});
