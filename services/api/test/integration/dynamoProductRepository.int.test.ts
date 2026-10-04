import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { DynamoProductRepository } from '../../src/modules/catalog/infra/dynamoProductRepository.js';
import { productsTableDefinition, sampleProduct } from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const TABLE = 'products-test';
let dynamo: DynamoLocal;
let repo: DynamoProductRepository;

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(TABLE)));
  repo = new DynamoProductRepository(dynamo.doc, TABLE);
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
