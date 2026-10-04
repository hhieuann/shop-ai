import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import type { Product } from '../../src/modules/catalog/domain/product.js';
import {
  categoryStatusKey,
  PRODUCTS_BY_CATEGORY_INDEX,
} from '../../src/modules/catalog/infra/dynamoProductRepository.js';

/** Theo docs/business/dynamodb-design.md; giữ khớp với bảng products trong infra/. */
export function productsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [
      { AttributeName: 'productId', AttributeType: 'S' },
      { AttributeName: 'categoryStatus', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'productId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: PRODUCTS_BY_CATEGORY_INDEX,
        KeySchema: [
          { AttributeName: 'categoryStatus', KeyType: 'HASH' },
          { AttributeName: 'productId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
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

let sequence = 0;

/**
 * Như sampleProduct nhưng mỗi lần gọi có productId riêng, tăng dần theo thứ tự tạo (giống ULID thật).
 * Dùng khi test cần nhiều sản phẩm khác nhau, vd. sắp xếp và phân trang.
 */
export function uniqueProduct(overrides: Partial<Product> = {}): Product {
  sequence += 1;
  return sampleProduct({
    productId: `01K6PZ3Q5G${String(sequence).padStart(16, '0')}`,
    ...overrides,
  });
}

/** Item như khi nạp vào bảng thật: sản phẩm kèm khoá GSI categoryStatus. */
export function productItem(product: Product): Product & { readonly categoryStatus: string } {
  return { ...product, categoryStatus: categoryStatusKey(product.category, product.status) };
}
