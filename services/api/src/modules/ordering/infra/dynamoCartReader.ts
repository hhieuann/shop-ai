import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { CartReader, StoredCart } from '../ports.js';

/**
 * Đọc giỏ của module cart, CHỈ ĐỌC bằng GetItem (ADR-0017, sửa 24/10). Schema theo bảng carts
 * (dynamodb-design.md; cartItemSchema ở modules/cart/infra/dynamoCartRepository.ts): cart đổi
 * schema thì phải sửa cả file này và phần ghi giỏ trong dynamoOrderStore.ts.
 */
const cartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int(),
      addedPrice: z.number().int(),
      addedAt: z.string(),
    }),
  ),
  version: z.string(),
});

export class DynamoCartReader implements CartReader {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(userId: string): Promise<StoredCart> {
    // Đọc mạnh: ngay sau đó giao dịch ghi giỏ có điều kiện version vừa đọc
    const { Item } = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { userId }, ConsistentRead: true }),
    );
    if (!Item) return { lines: [], version: null };
    const cart = cartSchema.parse(Item);
    return { lines: cart.items, version: cart.version };
  }
}
