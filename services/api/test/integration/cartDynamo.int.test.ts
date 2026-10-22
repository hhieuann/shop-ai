import { randomUUID } from 'node:crypto';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { addCartItem, getCart, mergeCart } from '../../src/modules/cart/application/cartService.js';
import { makeIdempotentUseCase } from '../../src/shared/idempotency.js';
import type { CartLine } from '../../src/modules/cart/domain/cart.js';
import { DynamoCartRepository } from '../../src/modules/cart/infra/dynamoCartRepository.js';
import { DynamoProductCatalog } from '../../src/modules/cart/infra/dynamoProductCatalog.js';
import { CartVersionConflictError } from '../../src/modules/cart/ports.js';
import { cartsTableDefinition } from '../helpers/cart.js';
import { productItem, productsTableDefinition, sampleProduct } from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const CARTS = 'carts-test';
const PRODUCTS = 'products-test';
const IDEMPOTENCY = 'cart-idempotency-test';
const NOW = '2026-10-13T03:00:00.000Z';
let dynamo: DynamoLocal;
let carts: DynamoCartRepository;
let catalog: DynamoProductCatalog;

const line = (productId: string, quantity = 1): CartLine => ({
  productId,
  quantity,
  addedPrice: 1_000,
  addedAt: NOW,
});

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(cartsTableDefinition(CARTS)));
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(PRODUCTS)));
  await dynamo.client.send(
    new CreateTableCommand({
      TableName: IDEMPOTENCY,
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
  carts = new DynamoCartRepository(dynamo.doc, CARTS);
  catalog = new DynamoProductCatalog(dynamo.doc, PRODUCTS, { baseDelayMs: 0 });
});

afterAll(async () => {
  await dynamo?.stop();
});

describe('DynamoCartRepository', () => {
  it('get_returnsEmptyCartWithoutVersion_whenUserHasNoCart', async () => {
    // Act
    const result = await carts.get('user-none');

    // Assert
    expect(result).toEqual({ lines: [], version: null });
  });

  it('save_thenGet_roundTripsLinesWithNewVersion', async () => {
    // Arrange
    const lines = [line('gpu-1', 2), line('ram-1')];

    // Act
    await carts.save('user-1', lines, null, NOW);
    const result = await carts.get('user-1');

    // Assert
    expect(result.lines).toEqual(lines);
    expect(result.version).toEqual(expect.any(String));
  });

  it('save_throwsConflict_whenCartAlreadyCreatedByAnotherRequest', async () => {
    // Arrange: hai request cùng thấy "chưa có giỏ"
    await carts.save('user-2', [line('gpu-1')], null, NOW);

    // Act
    const result = carts.save('user-2', [line('ram-1')], null, NOW);

    // Assert
    await expect(result).rejects.toBeInstanceOf(CartVersionConflictError);
  });

  it('save_throwsConflict_whenVersionChangedSinceRead', async () => {
    // Arrange: hai request cùng đọc một phiên bản, request A ghi trước
    await carts.save('user-3', [line('gpu-1')], null, NOW);
    const { version } = await carts.get('user-3');
    await carts.save('user-3', [line('gpu-1', 2)], version, NOW);

    // Act: request B ghi với phiên bản cũ
    const result = carts.save('user-3', [line('gpu-1', 5)], version, NOW);

    // Assert
    await expect(result).rejects.toBeInstanceOf(CartVersionConflictError);
    expect((await carts.get('user-3')).lines[0]?.quantity).toBe(2);
  });

  it('get_throwsZodError_whenItemIsMalformed', async () => {
    // Arrange: số lượng 0, như khi có người sửa tay dữ liệu trong bảng
    await dynamo.doc.send(
      new PutCommand({
        TableName: CARTS,
        Item: {
          userId: 'user-bad',
          items: [{ ...line('gpu-1'), quantity: 0 }],
          version: 'v',
          updatedAt: NOW,
        },
      }),
    );

    // Act + Assert
    await expect(carts.get('user-bad')).rejects.toBeInstanceOf(ZodError);
  });
});

describe('DynamoProductCatalog', () => {
  it('findMany_returnsOnlyCartFields_andSkipsMissingIds', async () => {
    // Arrange
    const gpu = sampleProduct({ productId: 'cat-gpu-1', price: 15_900_000, stock: 3 });
    await dynamo.doc.send(new PutCommand({ TableName: PRODUCTS, Item: productItem(gpu) }));

    // Act
    const result = await catalog.findMany(['cat-gpu-1', 'khong-co', 'cat-gpu-1']);

    // Assert: không có description, brand, specs… và id trùng chỉ đọc một lần
    expect([...result.keys()]).toEqual(['cat-gpu-1']);
    expect(result.get('cat-gpu-1')).toEqual({
      productId: 'cat-gpu-1',
      name: gpu.name,
      imageUrl: gpu.imageUrl,
      price: 15_900_000,
      stock: 3,
      status: 'ACTIVE',
    });
  });

  it('findMany_readsMoreThan50Ids_inSeveralCalls', async () => {
    // Arrange
    const ids = Array.from({ length: 60 }, (_, i) => `many-${String(i).padStart(2, '0')}`);
    for (const productId of ids) {
      await dynamo.doc.send(
        new PutCommand({ TableName: PRODUCTS, Item: productItem(sampleProduct({ productId })) }),
      );
    }

    // Act
    const result = await catalog.findMany(ids);

    // Assert
    expect(result.size).toBe(60);
  });

  it('findMany_treatsMalformedProductAsMissing_insteadOfFailingWholeCart', async () => {
    // Arrange: thiếu giá
    await dynamo.doc.send(
      new PutCommand({
        TableName: PRODUCTS,
        Item: { productId: 'cat-bad', name: 'Thiếu giá', stock: 1, status: 'ACTIVE' },
      }),
    );

    // Act
    const result = await catalog.findMany(['cat-bad', 'cat-gpu-1']);

    // Assert
    expect([...result.keys()]).toEqual(['cat-gpu-1']);
  });

  it('findMany_retriesUnprocessedKeys_untilAllRead', async () => {
    // Arrange: lần gọi đầu DynamoDB chỉ xử lý được 1 khoá, trả phần còn lại trong UnprocessedKeys
    const db = dynamo.doc;
    const realSend = db.send.bind(db) as DynamoDBDocumentClient['send'];
    let calls = 0;
    const flaky = {
      send: vi.fn(async (command: Parameters<DynamoDBDocumentClient['send']>[0]) => {
        calls++;
        const output = (await realSend(command as never)) as {
          Responses?: Record<string, Record<string, unknown>[]>;
          UnprocessedKeys?: Record<string, { Keys: Record<string, unknown>[] }>;
        };
        if (calls === 1) {
          const [first, ...rest] = output.Responses?.[PRODUCTS] ?? [];
          return {
            ...output,
            Responses: { [PRODUCTS]: first ? [first] : [] },
            UnprocessedKeys: {
              [PRODUCTS]: { Keys: rest.map((item) => ({ productId: item.productId })) },
            },
          };
        }
        return output;
      }),
    } as unknown as DynamoDBDocumentClient;
    const retrying = new DynamoProductCatalog(flaky, PRODUCTS, { baseDelayMs: 0 });

    // Act
    const result = await retrying.findMany(['many-00', 'many-01', 'many-02']);

    // Assert
    expect(result.size).toBe(3);
    expect(calls).toBe(2);
  });
});

describe('cart use cases on DynamoDB Local', () => {
  it('addCartItem_thenGetCart_returnsCurrentProductData', async () => {
    // Arrange
    const deps = { carts, catalog, now: () => NOW };

    // Act
    await addCartItem(deps, { userId: 'user-flow', productId: 'cat-gpu-1', quantity: 2 });
    await addCartItem(deps, { userId: 'user-flow', productId: 'cat-gpu-1', quantity: 1 });
    const view = await getCart(deps, { userId: 'user-flow' });

    // Assert: BR-04 cộng dồn; totalAmount chỉ tính món đặt được (tồn kho 3, giỏ 3)
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({ productId: 'cat-gpu-1', quantity: 3, stock: 3 });
    expect(view.totalAmount).toBe(3 * 15_900_000);
  });

  it('mergeCart_withIdempotency_addsGuestItemsOnlyOnce_whenSameKeySentTwice', async () => {
    // Arrange: cách lambda.ts ghép use case gộp giỏ với helper idempotency (ADR-0017)
    const deps = { carts, catalog, now: () => NOW };
    const merge = makeIdempotentUseCase(
      (payload: { items: { productId: string; quantity: number }[] }, userId: string) =>
        mergeCart(deps, { userId, items: payload.items }),
      { tableName: IDEMPOTENCY, inProgressCode: 'MERGE_IN_PROGRESS', client: dynamo.client },
    );
    await addCartItem(deps, { userId: 'user-merge', productId: 'cat-gpu-1', quantity: 1 });
    const request = {
      userId: 'user-merge',
      // Sinh lúc chạy, không viết cứng (gitleaks báo nhầm chuỗi UUID là khoá API)
      idempotencyKey: randomUUID(),
      payload: { items: [{ productId: 'cat-gpu-1', quantity: 1 }] },
    };

    // Act: mạng lỗi, web gửi lại cùng khoá
    const first = await merge(request);
    const second = await merge(request);

    // Assert: tiêu chí "gọi lại cùng khoá thì giỏ không cộng dồn thêm lần nữa"
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.value).toEqual(first.value);
    expect(first.value.mergedExisting).toEqual(['cat-gpu-1']);
    const view = await getCart(deps, { userId: 'user-merge' });
    expect(view.items[0]?.quantity).toBe(2);
  });
});
