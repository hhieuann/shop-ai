import {
  GetCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
  type QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductStatus,
} from '../domain/product.js';
import type { ProductListReader, ProductRepository } from '../ports.js';

/**
 * Bảng products theo docs/business/dynamodb-design.md: khoá chính `productId`;
 * GSI `byCategory` với khoá `categoryStatus` (vd. "gpu#ACTIVE") và sort key `productId`.
 * Giữ khớp với test/helpers/catalog.ts và bảng trong infra/.
 * z.object bỏ các thuộc tính không khai báo, nên `categoryStatus`, `nameSearch` không lọt ra API.
 */
export const PRODUCTS_BY_CATEGORY_INDEX = 'byCategory';

/** Giá trị khoá GSI. Ai ghi sản phẩm vào bảng (seed, admin) cũng phải ghi kèm thuộc tính này. */
export function categoryStatusKey(category: ProductCategory, status: ProductStatus): string {
  return `${category}#${status}`;
}

const productItem = z.object({
  productId: z.string(),
  name: z.string(),
  // Loại lạ trong bảng là dữ liệu hỏng: báo lỗi thay vì trả category ngoài 13 loại của OpenAPI
  category: z.enum(PRODUCT_CATEGORIES),
  brand: z.string(),
  price: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  description: z.string(),
  imageUrl: z.string().optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface DynamoProductRepositoryOptions {
  /** Số item tối đa mỗi lần Query; để trống thì DynamoDB tự chia trang theo 1 MB. Test đặt nhỏ để thử đọc nhiều trang. */
  readonly queryPageSize?: number;
}

export class DynamoProductRepository implements ProductRepository, ProductListReader {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly options: DynamoProductRepositoryOptions = {},
  ) {}

  async findById(productId: string): Promise<Product | null> {
    const { Item } = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { productId } }),
    );
    if (!Item) return null;
    // Dữ liệu trong bảng sai kiểu thì báo lỗi ngay, không trả dữ liệu hỏng cho web.
    return productItem.parse(Item);
  }

  /** Query GSI theo `<category>#ACTIVE`, đọc tới hết LastEvaluatedKey. Không Scan. */
  async listActiveByCategory(category: ProductCategory): Promise<Product[]> {
    const products: Product[] = [];
    let startKey: QueryCommandOutput['LastEvaluatedKey'];

    do {
      const page: QueryCommandOutput = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: PRODUCTS_BY_CATEGORY_INDEX,
          KeyConditionExpression: 'categoryStatus = :key',
          ExpressionAttributeValues: { ':key': categoryStatusKey(category, 'ACTIVE') },
          ExclusiveStartKey: startKey,
          Limit: this.options.queryPageSize,
        }),
      );
      for (const item of page.Items ?? []) products.push(productItem.parse(item));
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return products;
  }
}
