import { QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { BY_STATUS_INDEX, DynamoOrderStore } from './dynamoOrderStore.js';

const ORDER_ID = '01K8GQ5Z3XM2T9V4B6N8P0R2S4';

/** Item đúng như index `byStatus` chiếu ALL: có cả địa chỉ */
const INDEX_ITEM = {
  orderId: ORDER_ID,
  userId: 'user-1',
  status: 'CONFIRMED',
  items: [{ productId: 'gpu-1', name: 'ASUS TUF RTX 4070', price: 15_900_000, quantity: 1 }],
  totalAmount: 15_900_000,
  createdAt: '2026-10-25T03:00:00.000Z',
};

/** Client giả ghi lại lệnh gửi; Query trả `items` */
function fakeDb(items: Record<string, unknown>[]) {
  const send = vi.fn<(command: unknown) => Promise<{ Items: Record<string, unknown>[] }>>(
    async () => ({ Items: items }),
  );
  const db = { send } as unknown as DynamoDBDocumentClient;
  const store = new DynamoOrderStore(db, {
    orders: 'orders',
    products: 'products',
    carts: 'carts',
  });
  return { store, send };
}

function queryInput(send: ReturnType<typeof fakeDb>['send']) {
  const command = send.mock.calls[0]?.[0];
  expect(command).toBeInstanceOf(QueryCommand);
  return (command as QueryCommand).input;
}

describe('DynamoOrderStore · đọc index byStatus cho admin (O8)', () => {
  it('listByStatus_queriesIndexWithProjection_withoutShippingAddress', async () => {
    // Arrange
    const { store, send } = fakeDb([INDEX_ITEM]);

    // Act
    const page = await store.listByStatus('CONFIRMED', { limit: 20 });

    // Assert
    expect(page.orders).toEqual([
      {
        orderId: ORDER_ID,
        status: 'CONFIRMED',
        totalAmount: 15_900_000,
        itemCount: 1,
        firstItemName: 'ASUS TUF RTX 4070',
        createdAt: '2026-10-25T03:00:00.000Z',
      },
    ]);
    // Verify: có ProjectionExpression và không đọc địa chỉ (index chiếu ALL nên có đủ)
    const input = queryInput(send);
    expect(input.IndexName).toBe(BY_STATUS_INDEX);
    expect(input.ProjectionExpression).toBeDefined();
    expect(input.ProjectionExpression).not.toMatch(/shippingAddress/);
    expect(input.ScanIndexForward).toBe(false);
    expect(input.Limit).toBe(21);
  });

  it('listByStatus_pagesByOrderIdOnly_soCursorNeedsNoUserId', async () => {
    const { store, send } = fakeDb([]);

    await store.listByStatus('SHIPPED', { limit: 5, beforeOrderId: ORDER_ID });

    const input = queryInput(send);
    expect(input.KeyConditionExpression).toBe('#status = :status AND orderId < :before');
    expect(input.ExpressionAttributeValues).toEqual({ ':status': 'SHIPPED', ':before': ORDER_ID });
    expect(input.ExclusiveStartKey).toBeUndefined();
  });

  it('findInStatus_readsProjectionWithUserId_withoutShippingAddress', async () => {
    const { store, send } = fakeDb([INDEX_ITEM]);

    const record = await store.findInStatus('CONFIRMED', ORDER_ID);

    expect(record).toMatchObject({ orderId: ORDER_ID, userId: 'user-1', status: 'CONFIRMED' });
    expect(record).not.toHaveProperty('shippingAddress');
    const input = queryInput(send);
    expect(input.ProjectionExpression).not.toMatch(/shippingAddress/);
    expect(input.ExpressionAttributeValues).toEqual({
      ':status': 'CONFIRMED',
      ':orderId': ORDER_ID,
    });
  });

  it('findInStatus_returnsNull_whenNotInPartition', async () => {
    const { store } = fakeDb([]);

    expect(await store.findInStatus('SHIPPED', ORDER_ID)).toBeNull();
  });
});
