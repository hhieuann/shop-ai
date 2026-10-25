import { ConditionalCheckFailedException, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StoredEvent } from '../../src/modules/events/domain/event.js';
import { DynamoEventRepository } from '../../src/modules/events/infra/dynamoEventRepository.js';
import { eventsTableDefinition } from '../helpers/events.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const EVENTS = 'events-test';
let dynamo: DynamoLocal;
let repo: DynamoEventRepository;

const event = (overrides: Partial<StoredEvent> = {}): StoredEvent => ({
  userIdHash: 'hash-a',
  eventId: 'e1',
  productId: 'P1',
  eventType: 'VIEW',
  timestamp: '2026-10-22T03:00:00.000Z',
  ttl: 1_792_983_600,
  ...overrides,
});

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(eventsTableDefinition(EVENTS)));
  repo = new DynamoEventRepository(dynamo.doc, EVENTS);
});

afterAll(async () => {
  await dynamo?.stop();
});

describe('DynamoEventRepository', () => {
  it('put_storesEventsOfOneUserInTimeOrder', async () => {
    // Arrange
    await repo.put(event({ eventId: 'e2', timestamp: '2026-10-22T05:00:00.000Z' }));
    await repo.put(event({ eventId: 'e1', timestamp: '2026-10-22T04:00:00.000Z' }));

    // Act
    const { Items } = await dynamo.doc.send(
      new QueryCommand({
        TableName: EVENTS,
        KeyConditionExpression: 'userIdHash = :u',
        ExpressionAttributeValues: { ':u': 'hash-a' },
      }),
    );

    // Assert
    expect(Items?.map((i) => i['eventId'])).toEqual(['e1', 'e2']);
    expect(Items?.[0]).toMatchObject({ productId: 'P1', eventType: 'VIEW', ttl: 1_792_983_600 });
    expect(Items?.[0]).not.toHaveProperty('userId');
  });

  it('put_neverOverwritesExistingEvent', async () => {
    // Arrange
    const first = event({ userIdHash: 'hash-b' });
    await repo.put(first);

    // Act + Assert
    await expect(repo.put({ ...first, eventType: 'ADD_TO_CART' })).rejects.toBeInstanceOf(
      ConditionalCheckFailedException,
    );
  });

  it('putOnce_returnsFalse_andKeepsFirstRow_whenSameKeyIsWrittenAgain', async () => {
    // Arrange: cùng tin order-confirmed giao hai lần thì cùng khoá
    const purchase = event({
      userIdHash: 'hash-c',
      eventId: 'order-1#gpu-1',
      eventType: 'PURCHASE',
      productId: 'gpu-1',
      orderId: 'order-1',
      quantity: 1,
    });

    // Act
    const first = await repo.putOnce(purchase);
    const second = await repo.putOnce({ ...purchase, quantity: 9 });

    // Assert
    expect([first, second]).toEqual([true, false]);
    const { Items } = await dynamo.doc.send(
      new QueryCommand({
        TableName: EVENTS,
        KeyConditionExpression: 'userIdHash = :u',
        ExpressionAttributeValues: { ':u': 'hash-c' },
      }),
    );
    expect(Items).toHaveLength(1);
    expect(Items?.[0]).toMatchObject({ orderId: 'order-1', quantity: 1, eventType: 'PURCHASE' });
  });
});
