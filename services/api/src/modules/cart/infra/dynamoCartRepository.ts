import { randomUUID } from 'node:crypto';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { MAX_LINES, MAX_QUANTITY, type CartLine } from '../domain/cart.js';
import { CartVersionConflictError, type CartRepository, type StoredCart } from '../ports.js';

/**
 * Bảng carts theo docs/business/dynamodb-design.md: mỗi người một item, khoá `userId`,
 * `items` là danh sách tối đa 50 dòng. `version` đổi mỗi lần ghi để ghi có điều kiện:
 * hai request cùng sửa một giỏ thì request sau thất bại và use case đọc lại, làm lại.
 */
export const cartItemSchema = z.object({
  userId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY),
        addedPrice: z.number().int().nonnegative(),
        addedAt: z.string(),
      }),
    )
    .max(MAX_LINES),
  version: z.string(),
  updatedAt: z.string(),
});

export class DynamoCartRepository implements CartRepository {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(userId: string): Promise<StoredCart> {
    // Đọc mạnh (ConsistentRead): ngay sau đó sẽ ghi có điều kiện dựa trên version vừa đọc
    const { Item } = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { userId }, ConsistentRead: true }),
    );
    if (!Item) return { lines: [], version: null };
    const item = cartItemSchema.parse(Item);
    return { lines: item.items, version: item.version };
  }

  async save(
    userId: string,
    lines: readonly CartLine[],
    expectedVersion: string | null,
    updatedAt: string,
  ): Promise<void> {
    const item = {
      userId,
      items: lines.map(({ productId, quantity, addedPrice, addedAt }) => ({
        productId,
        quantity,
        addedPrice,
        addedAt,
      })),
      version: randomUUID(),
      updatedAt,
    };
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ...(expectedVersion === null
            ? { ConditionExpression: 'attribute_not_exists(userId)' }
            : {
                ConditionExpression: '#version = :expected',
                ExpressionAttributeNames: { '#version': 'version' },
                ExpressionAttributeValues: { ':expected': expectedVersion },
              }),
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new CartVersionConflictError(userId);
      }
      throw error;
    }
  }
}
