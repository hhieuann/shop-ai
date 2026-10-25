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

/**
 * Ghi thẳng `count` đơn cho một người (không qua place: BR-14 chỉ cho 3 đơn mở).
 * orderId tăng dần theo i như ULID tăng theo thời gian; trả về theo thứ tự mới nhất trước.
 */
async function seedOrders(userId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const orderId = `01K8${String(i).padStart(22, '0')}`;
    const order = buildOrder({
      orderId,
      userId,
      requested: [{ productId: 'gpu-1', quantity: 1, expectedPrice: 1_000_000 }],
      products: new Map([
        [
          'gpu-1',
          { productId: 'gpu-1', name: 'GPU', price: 1_000_000, stock: 9, status: 'ACTIVE' },
        ],
      ]),
      shippingAddress: ADDRESS,
      now: NOW,
    });
    await dynamo.doc.send(new PutCommand({ TableName: ORDERS, Item: { ...order } }));
    ids.push(orderId);
  }
  return ids.reverse();
}

/** Đọc hết lịch sử theo từng trang `limit`, như web bấm "Sau" tới khi hết */
async function readAllPages(userId: string, limit: number): Promise<string[][]> {
  const pages: string[][] = [];
  let afterOrderId: string | undefined;
  for (;;) {
    const page = await store.listByUser(userId, { limit, afterOrderId });
    pages.push(page.orders.map((o) => o.orderId));
    if (!page.hasMore) return pages;
    afterOrderId = page.orders.at(-1)?.orderId;
  }
}

describe('DynamoOrderStore.listByUser', () => {
  it('listByUser_returnsNewestFirst_andSkipsCounterAndMarker', async () => {
    // Arrange: #OPEN và #KEY#… cùng partition như place ghi
    const userId = randomUUID();
    const ids = await seedOrders(userId, 3);
    for (const orderId of ['#OPEN', `#KEY#${randomUUID()}`]) {
      await dynamo.doc.send(new PutCommand({ TableName: ORDERS, Item: { userId, orderId } }));
    }

    // Act: limit 3 đúng bằng số đơn, item # không được chiếm chỗ
    const page = await store.listByUser(userId, { limit: 3 });

    // Assert
    expect(page.orders.map((o) => o.orderId)).toEqual(ids);
    expect(page.hasMore).toBe(false);
    expect(page.orders[0]).toEqual({
      orderId: ids[0],
      status: 'PENDING',
      totalAmount: 1_000_000,
      itemCount: 1,
      createdAt: NOW,
    });
  });

  it('listByUser_pagesWithoutGapsOrDuplicates', async () => {
    // Arrange
    const userId = randomUUID();
    const ids = await seedOrders(userId, 5);

    // Act
    const pages = await readAllPages(userId, 2);

    // Assert
    expect(pages).toEqual([ids.slice(0, 2), ids.slice(2, 4), ids.slice(4)]);
  });

  it('listByUser_hasMoreFalse_whenCountIsExactMultipleOfLimit', async () => {
    // Arrange
    const userId = randomUUID();
    const ids = await seedOrders(userId, 4);

    // Act
    const pages = await readAllPages(userId, 2);

    // Assert: không có trang thứ 3 rỗng
    expect(pages).toEqual([ids.slice(0, 2), ids.slice(2)]);
  });

  it('listByUser_returnsOnlyOwnOrders', async () => {
    // Arrange
    const userA = randomUUID();
    const userB = randomUUID();
    const own = await seedOrders(userA, 1);
    await seedOrders(userB, 2);

    // Act
    const page = await store.listByUser(userA, { limit: 20 });

    // Assert
    expect(page.orders.map((o) => o.orderId)).toEqual(own);
  });

  it('listByUser_returnsEmpty_whenUserHasNoOrders', async () => {
    // Act
    const page = await store.listByUser(randomUUID(), { limit: 20 });

    // Assert
    expect(page).toEqual({ orders: [], hasMore: false });
  });

  it('listByUser_doesNotReadShippingAddress', async () => {
    // Arrange
    const userId = randomUUID();
    await seedOrders(userId, 1);
    const send = vi.spyOn(dynamo.doc, 'send');

    // Act
    const page = await store.listByUser(userId, { limit: 20 });

    // Assert
    expect(JSON.stringify(page)).not.toContain(ADDRESS.phone);
    const query = send.mock.calls[0]?.[0] as QueryCommand;
    expect(query.input.ProjectionExpression).not.toContain('shippingAddress');
    send.mockRestore();
  });
});

describe('DynamoOrderStore.cancel', () => {
  const LATER = '2026-10-25T04:00:00.000Z';

  async function orderStatus(userId: string, orderId: string): Promise<string | undefined> {
    return (await store.get(userId, orderId))?.status;
  }

  it('cancel_restocksEachItemAndDecrementsOpen_whenPending', async () => {
    // Arrange: đơn PENDING mua 3 món A
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const cmd = command(userId, gpu, 3);
    await store.place(cmd);

    // Act
    const result = await store.cancel({ order: cmd.order, now: LATER });

    // Assert
    expect(result).toBe('cancelled');
    const saved = await store.get(userId, cmd.order.orderId);
    expect(saved).toMatchObject({ status: 'CANCELLED', updatedAt: LATER });
    expect(await stockOf(gpu.productId)).toBe(5);
    expect(await openOrders(userId)).toBe(0);
  });

  it('cancel_returnsStatusChanged_andRestocksOnce_whenCancelledTwice', async () => {
    // Arrange
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const cmd = command(userId, gpu, 3);
    await store.place(cmd);
    await store.cancel({ order: cmd.order, now: LATER });

    // Act: lần hai vẫn tưởng đơn PENDING
    const result = await store.cancel({ order: cmd.order, now: LATER });

    // Assert: không cộng kho, không giảm bộ đếm thêm
    expect(result).toBe('statusChanged');
    expect(await stockOf(gpu.productId)).toBe(5);
    expect(await openOrders(userId)).toBe(0);
  });

  it('cancel_returnsStatusChanged_andWritesNothing_whenShippedSinceRead', async () => {
    // Arrange: đọc lúc PENDING, admin đã chuyển SHIPPED
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const cmd = command(userId, gpu, 2);
    await store.place(cmd);
    await dynamo.doc.send(
      new UpdateCommand({
        TableName: ORDERS,
        Key: { userId, orderId: cmd.order.orderId },
        UpdateExpression: 'SET #status = :shipped',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':shipped': 'SHIPPED' },
      }),
    );

    // Act
    const result = await store.cancel({ order: cmd.order, now: LATER });

    // Assert
    expect(result).toBe('statusChanged');
    expect(await orderStatus(userId, cmd.order.orderId)).toBe('SHIPPED');
    expect(await stockOf(gpu.productId)).toBe(3);
  });

  it('cancel_allowsPlacingAgain_whenUserHadThreeOpenOrders', async () => {
    // Arrange: đủ 3 đơn mở, đơn thứ 4 bị chặn (BR-14)
    const userId = randomUUID();
    const gpu = await seedProduct(10);
    const placed = [command(userId, gpu), command(userId, gpu), command(userId, gpu)];
    for (const cmd of placed) await store.place(cmd);
    await expect(store.place(command(userId, gpu))).rejects.toBeInstanceOf(TooManyOpenOrdersError);

    // Act
    await store.cancel({ order: placed[0]!.order, now: LATER });
    const again = await store.place(command(userId, gpu));

    // Assert
    expect(again).toEqual({ kind: 'created' });
    expect(await openOrders(userId)).toBe(3);
  });

  it('cancel_throws_andDoesNotCreateProduct_whenProductMissing', async () => {
    // Arrange: đơn ghi thẳng, trỏ tới sản phẩm không có trong bảng products
    const userId = randomUUID();
    const gpu = await seedProduct(5);
    const cmd = command(userId, gpu);
    const ghostId = `ghost-${randomUUID()}`;
    const order = { ...cmd.order, items: [{ ...cmd.order.items[0]!, productId: ghostId }] };
    await dynamo.doc.send(new PutCommand({ TableName: ORDERS, Item: { ...order } }));
    await dynamo.doc.send(
      new PutCommand({ TableName: ORDERS, Item: { userId, orderId: '#OPEN', openOrders: 1 } }),
    );

    // Act
    const act = store.cancel({ order, now: LATER });

    // Assert: dữ liệu hỏng → lỗi để handler trả 500; không ghi gì
    await expect(act).rejects.toThrow();
    const { Item } = await dynamo.doc.send(
      new GetCommand({ TableName: PRODUCTS, Key: { productId: ghostId } }),
    );
    expect(Item).toBeUndefined();
    expect(await orderStatus(userId, order.orderId)).toBe('PENDING');
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
