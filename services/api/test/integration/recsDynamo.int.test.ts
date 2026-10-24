import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DynamoProductCatalog } from '../../src/modules/recommendation/infra/dynamoProductCatalog.js';
import { DynamoRecsStore } from '../../src/modules/recommendation/infra/dynamoRecsStore.js';
import { productItem, productsTableDefinition, sampleProduct } from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const RECS = 'recs-test';
const PRODUCTS = 'products-test';
let dynamo: DynamoLocal;

/** Giống infra/lib/recs-table.ts: pk, sk kiểu String */
async function createRecsTable(): Promise<void> {
  await dynamo.client.send(
    new CreateTableCommand({
      TableName: RECS,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
}

/** Dòng gợi ý như pipeline ghi (data/src/data/pipeline/recs_table.py) */
function row(pk: string, version: number, rank: number, itemId: string) {
  return {
    PutRequest: {
      Item: {
        pk,
        sk: `${version}#${String(rank).padStart(2, '0')}`,
        itemId,
        score: 1,
        source: 'ITEM_CF',
      },
    },
  };
}

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await createRecsTable();
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(PRODUCTS)));
});

afterAll(async () => {
  await dynamo?.stop();
});

describe('DynamoRecsStore', () => {
  it('rankedProductIds_returnsRowsOfOneVersionInRankOrder', async () => {
    // Arrange: hai phiên bản cùng anchor, ghi lộn thứ tự hạng
    await dynamo.doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [RECS]: [
            row('ALSO_BOUGHT#gpu-1', 20261026, 1, 'old'),
            row('ALSO_BOUGHT#gpu-1', 20261027, 2, 'b'),
            row('ALSO_BOUGHT#gpu-1', 20261027, 10, 'c'),
            row('ALSO_BOUGHT#gpu-1', 20261027, 1, 'a'),
          ],
        },
      }),
    );
    const store = new DynamoRecsStore(dynamo.doc, RECS);

    // Act
    const ids = await store.rankedProductIds('ALSO_BOUGHT', 'gpu-1', 20261027);

    // Assert
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('activePointer_readsVersionAndBasis_andReturnsNullWhenMissing', async () => {
    // Arrange
    await dynamo.doc.send(
      new PutCommand({
        TableName: RECS,
        Item: { pk: 'META', sk: 'ACTIVE#BESTSELLER', activeVersion: 20261027, basis: 'NEWEST' },
      }),
    );
    const store = new DynamoRecsStore(dynamo.doc, RECS);

    // Act + Assert
    expect(await store.activePointer('BESTSELLER')).toEqual({ version: 20261027, basis: 'NEWEST' });
    expect(await store.activePointer('FOR_YOU')).toBeNull();
  });

  it('activePointer_keepsValueFor60Seconds', async () => {
    // Arrange
    let now = 0;
    const store = new DynamoRecsStore(dynamo.doc, RECS, { now: () => now });
    const put = (version: number) =>
      dynamo.doc.send(
        new PutCommand({
          TableName: RECS,
          Item: { pk: 'META', sk: 'ACTIVE#ALSO_BOUGHT', activeVersion: version },
        }),
      );
    await put(1);
    await store.activePointer('ALSO_BOUGHT');
    await put(2);

    // Act
    now = 59_000;
    const cached = await store.activePointer('ALSO_BOUGHT');
    now = 61_000;
    const fresh = await store.activePointer('ALSO_BOUGHT');

    // Assert: pipeline đổi con trỏ thì tối đa 60 giây sau API mới thấy
    expect(cached).toEqual({ version: 1 });
    expect(fresh).toEqual({ version: 2 });
  });
});

describe('DynamoProductCatalog (recommendation)', () => {
  it('findMany_returnsProductSummaries_andSkipsMissingIds', async () => {
    // Arrange
    const product = sampleProduct();
    await dynamo.doc.send(new PutCommand({ TableName: PRODUCTS, Item: productItem(product) }));
    const catalog = new DynamoProductCatalog(dynamo.doc, PRODUCTS);

    // Act
    const found = await catalog.findMany([product.productId, 'gone']);

    // Assert: chỉ các thuộc tính của ProductSummary, không có description, createdAt
    expect([...found.keys()]).toEqual([product.productId]);
    expect(found.get(product.productId)).toEqual({
      productId: product.productId,
      name: product.name,
      category: product.category,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      status: product.status,
      imageUrl: product.imageUrl,
      specs: product.specs,
    });
  });
});
