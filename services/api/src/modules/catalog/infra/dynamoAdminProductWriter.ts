import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AdminProductPatch } from '../domain/adminProduct.js';
import type { Product } from '../domain/product.js';
import type { AdminProductWriter } from '../ports.js';
import { categoryStatusKey, productItemSchema, toProductItem } from './dynamoProductRepository.js';

/** Thứ tự cố định để UpdateExpression giống nhau giữa các lần gọi (dễ đọc log, dễ test) */
const PATCH_FIELDS = [
  'name',
  'brand',
  'price',
  'stock',
  'status',
  'description',
  'imageUrl',
  'specs',
] as const;

/** Điều kiện sai: trả null để use case đọc lại; lỗi khác ném ra */
async function unlessConditionFails<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return null;
    throw error;
  }
}

/**
 * Ghi của API admin sản phẩm (dynamodb-design.md "Ghi của admin"): PutItem, UpdateItem có điều
 * kiện, không DeleteItem. Mọi tên thuộc tính đi qua ExpressionAttributeNames (`name`, `status` là từ
 * khoá của DynamoDB).
 */
export class DynamoAdminProductWriter implements AdminProductWriter {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(product: Product): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toProductItem(product),
        ConditionExpression: 'attribute_not_exists(productId)',
      }),
    );
  }

  async update(input: {
    readonly product: Pick<Product, 'productId' | 'category'>;
    readonly patch: AdminProductPatch;
    readonly seenUpdatedAt: string;
    readonly expectedStock?: number;
    readonly now: string;
  }): Promise<Product | null> {
    const { product, patch } = input;
    const names: Record<string, string> = { '#updatedAt': 'updatedAt', '#deletedAt': 'deletedAt' };
    const values: Record<string, unknown> = { ':now': input.now, ':seen': input.seenUpdatedAt };
    const set = ['#updatedAt = :now'];
    const remove: string[] = [];

    for (const field of PATCH_FIELDS) {
      const value = patch[field];
      if (value === undefined) continue;
      names[`#${field}`] = field;
      if (value === null) {
        remove.push(`#${field}`);
        continue;
      }
      set.push(`#${field} = :${field}`);
      values[`:${field}`] = value;
    }
    if (patch.status !== undefined) {
      names['#categoryStatus'] = 'categoryStatus';
      set.push('#categoryStatus = :categoryStatus');
      values[':categoryStatus'] = categoryStatusKey(product.category, patch.status);
    }

    const conditions = ['#updatedAt = :seen', 'attribute_not_exists(#deletedAt)'];
    if (input.expectedStock !== undefined) {
      names['#stock'] = 'stock';
      values[':expectedStock'] = input.expectedStock;
      conditions.push('#stock = :expectedStock');
    }

    return unlessConditionFails(async () => {
      const { Attributes } = await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { productId: product.productId },
          UpdateExpression: `SET ${set.join(', ')}${remove.length ? ` REMOVE ${remove.join(', ')}` : ''}`,
          ConditionExpression: conditions.join(' AND '),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        }),
      );
      return productItemSchema.parse(Attributes);
    });
  }
}
