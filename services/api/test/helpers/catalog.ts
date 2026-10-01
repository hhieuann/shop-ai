import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import type { Product } from '../../src/modules/catalog/domain/product.js';

/** Giữ khớp với bảng products trong infra/. */
export function productsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  };
}

export function sampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'gpu-rtx4070',
    name: 'NVIDIA GeForce RTX 4070 12GB',
    category: 'gpu',
    priceVnd: 15_990_000,
    stock: 12,
    attributes: { vramGb: 12, tdpW: 200 },
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}
