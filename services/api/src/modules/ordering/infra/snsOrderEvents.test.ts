import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import { describe, expect, it, vi } from 'vitest';
import { SnsOrderEvents } from './snsOrderEvents.js';

describe('SnsOrderEvents', () => {
  it('publishConfirmed_sendsRawJsonToTopic', async () => {
    // Arrange
    const send = vi.fn().mockResolvedValue({});
    const events = new SnsOrderEvents({ send } as unknown as SNSClient, 'arn:topic-test');
    const event = {
      orderId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
      userId: 'user-1',
      confirmedAt: '2026-10-25T09:00:00.000Z',
      items: [{ productId: 'gpu-1', quantity: 2 }],
    };

    // Act
    await events.publishConfirmed(event);

    // Verify: hàng đợi events nhận raw message, nên Message đúng là JSON của tin
    const command = send.mock.calls[0]?.[0] as PublishCommand;
    expect(command).toBeInstanceOf(PublishCommand);
    expect(command.input).toEqual({ TopicArn: 'arn:topic-test', Message: JSON.stringify(event) });
  });
});
