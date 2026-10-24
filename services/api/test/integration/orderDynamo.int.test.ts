import { randomUUID } from 'node:crypto';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  placeOrder,
  type PlaceOrderDeps,
} from '../../src/modules/ordering/application/placeOrder.js';
import {
  OutOfStockError,
  PriceChangedError,
  TooManyOpenOrdersError,
} from '../../src/modules/ordering/domain/errors.js';
import { buildOrder, type ProductSnapshot } from '../../src/modules/ordering/domain/order.js';
import { markerExpiresAt, payloadHash } from '../../src/modules/ordering/domain/placement.js';
import { DynamoCartReader } from '../../src/modules/ordering/infra/dynamoCartReader.js';
import { DynamoOrderStore } from '../../src/modules/ordering/infra/dynamoOrderStore.js';
import { DynamoProductCatalog } from '../../src/modules/ordering/infra/dynamoProductCatalog.js';
import { CartChangedError, type PlaceOrderCommand } from '../../src/modules/ordering/ports.js';
import { cartsTableDefinition } from '../helpers/cart.js';
import { productItem, productsTableDefinition, uniqueProduct } from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';
import { ordersTableDefinition } from '../helpers/ordering.js';

const ORDERS = 'orders-test';
const PRODUCTS = 'products-test';
const CARTS = 'carts-test';
const NOW = '2026-10-25T03:00:00.000Z';
const ADDRESS = {
  fullName: 'Nguyễn Văn A',
  phone: '0912345678',
  address: '12 Nguyễn Huệ, phường Bến Nghé',
  province: 'TP. Hồ Chí Minh',
};

let dynamo: DynamoLocal;
let store: DynamoOrderStore;
let catalog: DynamoProductCatalog;
let carts: DynamoCartReader;

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(ordersTableDefinition(ORDERS)));
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(PRODUCTS)));
  await dynamo.client.send(new CreateTableCommand(cartsTableDefinition(CARTS)));
  const tables = { orders: ORDERS, products: PRODUCTS, carts: CARTS };
  store = new DynamoOrderStore(dynamo.doc, tables, { baseDelayMs: 0 });
  catalog = new DynamoProductCatalog(dynamo.doc, PRODUCTS, { baseDelayMs: 0 });
  carts = new DynamoCartReader(dynamo.doc, CARTS);
});

afterAll(async () => {
  await dynamo?.stop();
});

/** Nạp một sản phẩm mới vào bảng products, trả snapshot ordering đọc được */
async function seedProduct(stock: number, price = 1_000_000): Promise<ProductSnapshot> {
  const product = uniqueProduct({ stock, price });
  await dynamo.doc.send(new PutCommand({ TableName: PRODUCTS, Item: productItem(product) }));
  return { productId: product.productId, name: product.name, price, stock, status: 'ACTIVE' };
}

async function seedCart(userId: string, productIds: string[]): Promise<string> {
  const version = randomUUID();
  await dynamo.doc.send(
    new PutCommand({
      TableName: CARTS,
      Item: {
        userId,
        items: productIds.map((productId) => ({
          productId,
          quantity: 1,
          addedPrice: 1,
          addedAt: NOW,
        })),
        version,
        updatedAt: NOW,
      },
    }),
  );
  return version;
}

async function stockOf(productId: string): Promise<number> {
  const { Item } = await dynamo.doc.send(
    new GetCommand({ TableName: PRODUCTS, Key: { productId } }),
  );
  return Item?.stock as number;
}

async function openOrders(userId: string): Promise<number | undefined> {
  const { Item } = await dynamo.doc.send(
    new GetCommand({ TableName: ORDERS, Key: { userId, orderId: '#OPEN' } }),
  );
  return Item?.openOrders as number | undefined;
}

/** Lệnh ghi cho một đơn mua `quantity` món `product`, khoá Idempotency mới mỗi lần */
function command(
  userId: string,
  product: ProductSnapshot,
  quantity = 1,
  cart: PlaceOrderCommand['cart'] = null,
  idempotencyKey = randomUUID(),
): PlaceOrderCommand {
  const requested = [{ productId: product.productId, quantity, expectedPrice: product.price }];
  const order = buildOrder({
    orderId: `01K8${randomUUID().replaceAll('-', '').slice(0, 22).toUpperCase()}`,
    userId,
    requested,
    products: new Map([[product.productId, product]]),
    shippingAddress: ADDRESS,
    now: NOW,
  });
  return {
    order,
    idempotencyKey,
    payloadHash: payloadHash(requested, ADDRESS),
    markerExpiresAt: markerExpiresAt(NOW),
    cart,
  };
}

describe('DynamoOrderStore.place', () => {
  it('place_writesOrderStockCartCounterAndMarker_inOneTransaction', async () => {
    // Arrange
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const bag = await seedProduct(5);
    const version = await seedCart(userId, [gpu.productId, bag.productId]);
    const cart = (await carts.get(userId)).lines.filter((l) => l.productId !== gpu.productId);
    const cmd = command(userId, gpu, 2, { remainingLines: cart, expectedVersion: version });

    // Act
    const result = await store.place(cmd);

    // Assert
    expect(result).toEqual({ kind: 'created' });
    expect(await stockOf(gpu.productId)).toBe(3);
    expect(await openOrders(userId)).toBe(1);
    const after = await carts.get(userId);
    expect(after.lines.map((l) => l.productId)).toEqual([bag.productId]);
    expect(after.version).not.toBe(version);
    expect(await store.get(userId, cmd.order.orderId)).toEqual(cmd.order);
    const { Item: marker } = await dynamo.doc.send(
      new GetCommand({ TableName: ORDERS, Key: { userId, orderId: `#KEY#${cmd.idempotencyKey}` } }),
    );
    expect(marker).toMatchObject({ refOrderId: cmd.order.orderId, payloadHash: cmd.payloadHash });
  });

  it('place_returnsExisting_andDoesNotDecrementTwice_whenSameKeyReplayed', async () => {
    // Arrange: giao dịch đã ghi xong, rồi gửi lại cùng khoá (lỗi sau commit)
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const first = command(userId, gpu, 1);
    await store.place(first);

    // Act: lần gửi lại tạo orderId mới nhưng cùng khoá, cùng nội dung
    const replay = { ...command(userId, gpu, 1), idempotencyKey: first.idempotencyKey };
    const result = await store.place(replay);

    // Assert
    expect(result).toEqual({
      kind: 'existing',
      orderId: first.order.orderId,
      payloadHash: first.payloadHash,
    });
    expect(await stockOf(gpu.productId)).toBe(4);
    expect(await openOrders(userId)).toBe(1);
    expect(await store.get(userId, replay.order.orderId)).toBeNull();
  });

  it('place_createsExactlyOneOrder_whenTwoBuyersRaceForLastItem', async () => {
    // Arrange
    const gpu = await seedProduct(1);

    // Act
    const results = await Promise.allSettled([
      store.place(command(randomUUID(), gpu, 1)),
      store.place(command(randomUUID(), gpu, 1)),
    ]);

    // Assert
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(OutOfStockError);
    expect((rejected.reason as OutOfStockError).invalidItems).toEqual([
      { productId: gpu.productId, available: 0 },
    ]);
    expect(await stockOf(gpu.productId)).toBe(0);
  });

  it('place_allowsOnlyOne_whenTwoParallelRequestsWithTwoOpenOrders', async () => {
    // Arrange: đã có 2 đơn đang mở
    const userId = randomUUID();
    const gpu = await seedProduct(20);
    await store.place(command(userId, gpu));
    await store.place(command(userId, gpu));

    // Act
    const results = await Promise.allSettled([
      store.place(command(userId, gpu)),
      store.place(command(userId, gpu)),
    ]);

    // Assert
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(TooManyOpenOrdersError);
    expect(await openOrders(userId)).toBe(3);
    expect(await stockOf(gpu.productId)).toBe(17);
  });

  it('place_throwsCartChanged_whenCartVersionMovedSinceRead', async () => {
    // Arrange
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const version = await seedCart(userId, [gpu.productId]);
    await seedCart(userId, [gpu.productId]); // request khác vừa ghi giỏ, version đổi

    // Act
    const promise = store.place(
      command(userId, gpu, 1, { remainingLines: [], expectedVersion: version }),
    );

    // Assert
    await expect(promise).rejects.toBeInstanceOf(CartChangedError);
    expect(await stockOf(gpu.productId)).toBe(5);
    expect(await openOrders(userId)).toBeUndefined();
  });

  it('place_throwsPriceChanged_whenPriceChangedAfterRead', async () => {
    // Arrange
    const gpu = await seedProduct(5, 1_000_000);
    await dynamo.doc.send(
      new UpdateCommand({
        TableName: PRODUCTS,
        Key: { productId: gpu.productId },
        UpdateExpression: 'SET price = :p',
        ExpressionAttributeValues: { ':p': 1_200_000 },
      }),
    );

    // Act
    const promise = store.place(command(randomUUID(), gpu));

    // Assert
    await expect(promise).rejects.toEqual(
      new PriceChangedError([
        { productId: gpu.productId, expectedPrice: 1_000_000, currentPrice: 1_200_000 },
      ]),
    );
    expect(await stockOf(gpu.productId)).toBe(5);
  });

  it('historyQuery_skipsCounterAndMarker_withOrderIdFromZero', async () => {
    // Arrange
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const cmd = command(userId, gpu);
    await store.place(cmd);

    // Act: điều kiện khoá lịch sử đơn theo dynamodb-design.md
    const { Items } = await dynamo.doc.send(
      new QueryCommand({
        TableName: ORDERS,
        KeyConditionExpression: 'userId = :u AND orderId >= :zero',
        ExpressionAttributeValues: { ':u': userId, ':zero': '0' },
      }),
    );

    // Assert
    expect(Items?.map((i) => i.orderId)).toEqual([cmd.order.orderId]);
    expect(await store.get(userId, '#OPEN')).toBeNull();
  });
});

describe('placeOrder với adapter thật', () => {
  it('placeOrder_returnsSameOrder_whenRetriedWithSameKeyAfterCommit', async () => {
    // Arrange
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    await seedCart(userId, [gpu.productId]);
    let id = 0;
    const deps: PlaceOrderDeps = {
      catalog,
      carts,
      orders: store,
      queue: { enqueue: vi.fn(async () => {}) },
      metrics: { enqueueFailed: vi.fn() },
      newOrderId: () => `01K8ORDER${String(++id).padStart(17, '0')}`,
      now: () => NOW,
    };
    const input = {
      userId,
      idempotencyKey: randomUUID(),
      correlationId: 'corr-1',
      items: [{ productId: gpu.productId, quantity: 2, expectedPrice: gpu.price }],
      shippingAddress: ADDRESS,
    };

    // Act
    const first = await placeOrder(deps, input);
    const second = await placeOrder(deps, input);

    // Assert
    expect(first.created).toBe(true);
    expect(second).toEqual({ order: first.order, created: false });
    expect(await stockOf(gpu.productId)).toBe(3);
    expect((await carts.get(userId)).lines).toEqual([]);

    // Verify: gửi tin cả hai lần, worker chống trùng theo orderId
    expect(deps.queue.enqueue).toHaveBeenCalledTimes(2);
  });
});
