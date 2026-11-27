import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Product } from '../../src/modules/catalog/domain/product.js';
import { DynamoAdminProductReader } from '../../src/modules/catalog/infra/dynamoAdminProductReader.js';
import { DynamoProductRepository } from '../../src/modules/catalog/infra/dynamoProductRepository.js';
import { productItem, productsTableDefinition, uniqueProduct } from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const TABLE = 'products-admin-test';
const DELETED_AT = '2026-11-25T08:00:00.000Z';
let dynamo: DynamoLocal;
let reader: DynamoAdminProductReader;
let repo: DynamoProductRepository;

/** Món xoá mềm như PR ghi (#545) sẽ ghi: INACTIVE, deletedAt, khoá GSI `<loại>#DELETED` */
function deletedItem(product: Product) {
  return {
    ...productItem({ ...product, status: 'INACTIVE', deletedAt: DELETED_AT }),
    categoryStatus: `${product.category}#DELETED`,
  };
}

const active = Array.from({ length: 3 }, (_, i) =>
  uniqueProduct({ category: 'gpu', name: `Card đang bán ${i}` }),
);
const hidden = uniqueProduct({ category: 'gpu', status: 'INACTIVE', name: 'Card đã ẩn' });
const deleted = uniqueProduct({ category: 'gpu', name: 'Card đã xoá' });
const otherCategory = uniqueProduct({ category: 'mouse', name: 'Chuột' });

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(TABLE)));
  // Mỗi lần Query chỉ 2 item để thử đọc và đếm qua nhiều trang (LastEvaluatedKey)
  reader = new DynamoAdminProductReader(dynamo.doc, TABLE, { queryPageSize: 2 });
  repo = new DynamoProductRepository(dynamo.doc, TABLE);
  for (const item of [
    ...active.map(productItem),
    productItem(hidden),
    deletedItem(deleted),
    productItem(otherCategory),
  ]) {
    await dynamo.doc.send(new PutCommand({ TableName: TABLE, Item: item }));
  }
});

afterAll(async () => {
  await dynamo?.stop();
});

describe('DynamoAdminProductReader (dynamodb-design.md Q3)', () => {
  it('listByGroup_returnsOnlyThatGroupOfCategory_newestFirst_acrossPages', async () => {
    // Act
    const result = await reader.listByGroup('gpu', 'ACTIVE');

    // Assert: ScanIndexForward false, SK là productId tăng dần theo thời gian tạo
    expect(result.map((p) => p.productId)).toEqual(active.map((p) => p.productId).reverse());
    expect(result[0]).not.toHaveProperty('categoryStatus');
  });

  it('listByGroup_returnsHiddenAndDeletedSeparately', async () => {
    // Act
    const inactive = await reader.listByGroup('gpu', 'INACTIVE');
    const removed = await reader.listByGroup('gpu', 'DELETED');

    // Assert: món đã xoá không nằm trong nhóm đã ẩn dù status là INACTIVE
    expect(inactive.map((p) => p.productId)).toEqual([hidden.productId]);
    expect(removed).toEqual([{ ...deleted, status: 'INACTIVE', deletedAt: DELETED_AT }]);
  });

  it('countByGroup_countsEachGroup_acrossPages', async () => {
    // Act
    const counts = await Promise.all([
      reader.countByGroup('gpu', 'ACTIVE'),
      reader.countByGroup('gpu', 'INACTIVE'),
      reader.countByGroup('gpu', 'DELETED'),
      reader.countByGroup('headset', 'ACTIVE'),
    ]);

    // Assert
    expect(counts).toEqual([3, 1, 1, 0]);
  });

  it('findById_returnsDeletedAt_forSoftDeletedProduct', async () => {
    // Act
    const result = await repo.findById(deleted.productId);

    // Assert: chi tiết admin thấy được món đã xoá; API khách lọc bằng isVisibleToCustomers
    expect(result).toMatchObject({ productId: deleted.productId, deletedAt: DELETED_AT });
  });

  it('listActiveByCategory_ofCustomerApi_neverReturnsDeletedProduct', async () => {
    // Act
    const result = await repo.listActiveByCategory('gpu');

    // Assert
    expect(result.map((p) => p.productId)).not.toContain(deleted.productId);
    expect(result.every((p) => p.deletedAt === undefined)).toBe(true);
  });
});
