import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import type { Product } from '../../src/modules/catalog/domain/product.js';

/** Theo docs/business/dynamodb-design.md; giữ khớp với bảng products trong infra/. */
export function productsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [{ AttributeName: 'productId', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'productId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  };
}

export function sampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    productId: '01K6PZ3Q5G0000000000000001',
    name: 'ASUS TUF Gaming GeForce RTX 4070 12GB',
    category: 'gpu',
    brand: 'ASUS',
    price: 15_990_000,
    stock: 3,
    status: 'ACTIVE',
    description: 'Card đồ hoạ RTX 4070 12GB GDDR6X, chơi game 1440p.',
    imageUrl: 'https://placehold.co/400x300?text=RTX+4070',
    specs: { vram: '12GB GDDR6X', tdp: '200W' },
    createdAt: '2026-10-01T07:00:00.000Z',
    updatedAt: '2026-10-04T07:00:00.000Z',
    ...overrides,
  };
}
