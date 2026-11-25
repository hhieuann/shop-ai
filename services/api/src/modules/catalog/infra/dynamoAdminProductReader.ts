import {
  QueryCommand,
  type DynamoDBDocumentClient,
  type QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import type { AdminProductGroup } from '../domain/adminProduct.js';
import type { Product, ProductCategory } from '../domain/product.js';
import type { AdminProductReader } from '../ports.js';
import {
  categoryStatusKey,
  PRODUCTS_BY_CATEGORY_INDEX,
  productItemSchema,
  type DynamoProductRepositoryOptions,
} from './dynamoProductRepository.js';

/**
 * Đọc cho API admin sản phẩm (dynamodb-design.md Q3): chỉ Query index `byCategory` theo
 * `<loại>#<nhóm>`, đọc tới hết LastEvaluatedKey. Không Scan, không đọc bảng khác.
 */
export class DynamoAdminProductReader implements AdminProductReader {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly options: DynamoProductRepositoryOptions = {},
  ) {}

  async listByGroup(category: ProductCategory, group: AdminProductGroup): Promise<Product[]> {
    const products: Product[] = [];
    let startKey: QueryCommandOutput['LastEvaluatedKey'];
    do {
      const page: QueryCommandOutput = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: PRODUCTS_BY_CATEGORY_INDEX,
          KeyConditionExpression: 'categoryStatus = :key',
          ExpressionAttributeValues: { ':key': categoryStatusKey(category, group) },
          // Mới nhất trước (SK là productId ULID); use case vẫn xếp lại sau khi gộp hai nhóm
          ScanIndexForward: false,
          ExclusiveStartKey: startKey,
          Limit: this.options.queryPageSize,
        }),
      );
      for (const item of page.Items ?? []) products.push(productItemSchema.parse(item));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return products;
  }

  async countByGroup(category: ProductCategory, group: AdminProductGroup): Promise<number> {
    let total = 0;
    let startKey: QueryCommandOutput['LastEvaluatedKey'];
    do {
      const page: QueryCommandOutput = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: PRODUCTS_BY_CATEGORY_INDEX,
          KeyConditionExpression: 'categoryStatus = :key',
          ExpressionAttributeValues: { ':key': categoryStatusKey(category, group) },
          Select: 'COUNT',
          ExclusiveStartKey: startKey,
          Limit: this.options.queryPageSize,
        }),
      );
      total += page.Count ?? 0;
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return total;
  }
}
