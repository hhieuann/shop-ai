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
  it('findById_returnsProduct_whenItemExists', async () => {
    // Arrange
    const product = sampleProduct({
      id: 'psu-750w',
      category: 'psu',
      attributes: { wattage: 750 },
    });
    await dynamo.doc.send(new PutCommand({ TableName: TABLE, Item: product }));

    // Act
    const result = await repo.findById('psu-750w');

    // Assert
    expect(result).toEqual(product);
  });

  it('findById_returnsNull_whenItemMissing', async () => {
    // Act
    const result = await repo.findById('khong-co');

    // Assert
    expect(result).toBeNull();
  });

  it('findById_throwsZodError_whenItemIsMalformed', async () => {
    // Arrange: thiếu giá, như khi có người sửa tay dữ liệu trong bảng
    await dynamo.doc.send(
      new PutCommand({ TableName: TABLE, Item: { id: 'thieu-gia', name: 'Sản phẩm thiếu giá' } }),
    );

    // Act
    const act = repo.findById('thieu-gia');

    // Assert
    await expect(act).rejects.toBeInstanceOf(ZodError);
  });
});
