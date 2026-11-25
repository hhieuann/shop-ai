import { CreateTableCommand, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DynamoAdminProductWriter } from '../../src/modules/catalog/infra/dynamoAdminProductWriter.js';
import { DynamoProductRepository } from '../../src/modules/catalog/infra/dynamoProductRepository.js';
import { productsTableDefinition, uniqueProduct } from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const TABLE = 'products-admin-writer-test';
const T1 = '2026-11-25T08:00:00.000Z';
const T2 = '2026-11-25T09:00:00.000Z';
let dynamo: DynamoLocal;
let writer: DynamoAdminProductWriter;
let repo: DynamoProductRepository;

/** Đọc thẳng item để thấy cả khoá GSI categoryStatus (repo bỏ trường này) */
async function rawItem(productId: string) {
  const { Item } = await dynamo.doc.send(new GetCommand({ TableName: TABLE, Key: { productId } }));
  return Item;
}

async function created(overrides: Parameters<typeof uniqueProduct>[0] = {}) {
  const product = uniqueProduct({ category: 'gpu', updatedAt: T1, ...overrides });
  await writer.create(product);
  return product;
}

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(TABLE)));
  writer = new DynamoAdminProductWriter(dynamo.doc, TABLE);
  repo = new DynamoProductRepository(dynamo.doc, TABLE);
});

afterAll(async () => {
  await dynamo?.stop();
});

describe('DynamoAdminProductWriter.create', () => {
  it('create_writesProductWithCategoryStatus', async () => {
    // Act
    const product = await created({ status: 'INACTIVE' });

    // Assert
    expect(await rawItem(product.productId)).toMatchObject({
      productId: product.productId,
      categoryStatus: 'gpu#INACTIVE',
    });
  });

  it('create_rejects_whenProductIdExists', async () => {
    // Arrange
    const product = await created();

    // Act
    const act = writer.create(product);

    // Assert
    await expect(act).rejects.toBeInstanceOf(ConditionalCheckFailedException);
  });
});

describe('DynamoAdminProductWriter.update', () => {
  it('update_setsFields_movesGsiKey_andBumpsUpdatedAt_whenConditionsHold', async () => {
    // Arrange
    const product = await created({ stock: 12 });

    // Act
    const saved = await writer.update({
      product,
      patch: { price: 15_490_000, stock: 10, status: 'INACTIVE', imageUrl: null },
      seenUpdatedAt: T1,
      expectedStock: 12,
      now: T2,
    });

    // Assert
    expect(saved).toMatchObject({
      price: 15_490_000,
      stock: 10,
      status: 'INACTIVE',
      updatedAt: T2,
    });
    expect(saved).not.toHaveProperty('imageUrl');
    expect(await rawItem(product.productId)).toMatchObject({ categoryStatus: 'gpu#INACTIVE' });
  });

  it('update_returnsNull_andWritesNothing_whenUpdatedAtDiffers', async () => {
    // Arrange
    const product = await created();

    // Act
    const saved = await writer.update({
      product,
      patch: { name: 'Tên mới' },
      seenUpdatedAt: '2026-11-01T00:00:00.000Z',
      now: T2,
    });

    // Assert
    expect(saved).toBeNull();
    expect(await repo.findById(product.productId)).toMatchObject({ name: product.name });
  });

  it('update_returnsNull_whenStockDiffersFromExpected', async () => {
    // Arrange: khách vừa đặt hàng, tồn kho 12 còn 10
    const product = await created({ stock: 10 });

    // Act
    const saved = await writer.update({
      product,
      patch: { stock: 20 },
      seenUpdatedAt: T1,
      expectedStock: 12,
      now: T2,
    });

    // Assert
    expect(saved).toBeNull();
    expect(await repo.findById(product.productId)).toMatchObject({ stock: 10 });
  });

  it('update_returnsNull_whenSoftDeleted', async () => {
    // Arrange
    const product = await created();
    // Món đã xoá mềm như PR xoá (BR-14) sẽ ghi
    await dynamo.doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { productId: product.productId },
        UpdateExpression: 'SET deletedAt = :at',
        ExpressionAttributeValues: { ':at': T1 },
      }),
    );

    // Act
    const saved = await writer.update({
      product,
      patch: { name: 'Tên mới' },
      seenUpdatedAt: T1,
      now: T2,
    });

    // Assert
    expect(saved).toBeNull();
  });

  it('update_returnsNull_whenProductMissing', async () => {
    // Act
    const saved = await writer.update({
      product: { productId: '01K6PZ3Q5G9999999999999999', category: 'gpu' },
      patch: { name: 'Tên mới' },
      seenUpdatedAt: T1,
      now: T2,
    });

    // Assert: không tạo item mới
    expect(saved).toBeNull();
    expect(await rawItem('01K6PZ3Q5G9999999999999999')).toBeUndefined();
  });
});
