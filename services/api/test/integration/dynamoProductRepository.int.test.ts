import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { DynamoProductRepository } from '../../src/modules/catalog/infra/dynamoProductRepository.js';
import {
  productItem,
  productsTableDefinition,
  sampleProduct,
  uniqueProduct,
} from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const TABLE = 'products-test';
let dynamo: DynamoLocal;
let repo: DynamoProductRepository;

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(TABLE)));
  // Mỗi lần Query chỉ lấy 2 item để thử đường đọc nhiều trang (LastEvaluatedKey)
  repo = new DynamoProductRepository(dynamo.doc, TABLE, { queryPageSize: 2 });
});

afterAll(async () => {
  await dynamo?.stop();
});

describe('DynamoProductRepository', () => {
  it('findById_returnsProductWithoutInternalFields_whenItemExists', async () => {
    // Arrange: nameSearch chỉ dùng để tìm kiếm, không được lọt ra ngoài
    const product = sampleProduct({ productId: '01K6PZ3Q5G0000000000000002' });
    await dynamo.doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { ...product, nameSearch: 'asus tuf gaming geforce rtx 4070 12gb' },
      }),
    );

    // Act
    const result = await repo.findById('01K6PZ3Q5G0000000000000002');

    // Assert
    expect(result).toEqual(product);
  });

  it('findById_returnsNull_whenItemMissing', async () => {
    // Act
    const result = await repo.findById('01K6PZ3Q5G0000000000000099');

    // Assert
    expect(result).toBeNull();
  });

  it('findById_throwsZodError_whenItemIsMalformed', async () => {
    // Arrange: thiếu giá, như khi có người sửa tay dữ liệu trong bảng
    await dynamo.doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { productId: '01K6PZ3Q5G0000000000000003', name: 'Sản phẩm thiếu giá' },
      }),
    );

    // Act
    const act = repo.findById('01K6PZ3Q5G0000000000000003');

    // Assert
    await expect(act).rejects.toBeInstanceOf(ZodError);
  });
});

describe('DynamoProductRepository.listActiveByCategory', () => {
  async function put(...products: Parameters<typeof productItem>[0][]) {
    for (const product of products) {
      await dynamo.doc.send(new PutCommand({ TableName: TABLE, Item: productItem(product) }));
    }
  }

  it('listActiveByCategory_returnsOnlyActiveProductsOfCategory_acrossPages', async () => {
    // Arrange: 5 chuột ACTIVE (3 trang khi mỗi trang 2 item), 1 chuột INACTIVE, 1 bàn phím ACTIVE
    const mice = Array.from({ length: 5 }, (_, i) =>
      uniqueProduct({ category: 'mouse', name: `Chuột ${i}` }),
    );
    await put(
      ...mice,
      uniqueProduct({ category: 'mouse', status: 'INACTIVE', name: 'Chuột ngừng bán' }),
      uniqueProduct({ category: 'keyboard', name: 'Bàn phím' }),
    );

    // Act
    const result = await repo.listActiveByCategory('mouse');

    // Assert
    expect(result.map((p) => p.productId).sort()).toEqual(mice.map((p) => p.productId).sort());
    expect(result[0]).not.toHaveProperty('categoryStatus');
  });

  it('listActiveByCategory_returnsEmpty_whenCategoryHasNoProducts', async () => {
    // Act
    const result = await repo.listActiveByCategory('headset');

    // Assert
    expect(result).toEqual([]);
  });
});
