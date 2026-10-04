import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { PRODUCT_CATEGORIES, type Product } from '../domain/product.js';
import type { ProductRepository } from '../ports.js';

/**
 * Bảng products theo docs/business/dynamodb-design.md: khoá chính `productId`.
 * Giữ khớp với test/helpers/catalog.ts và bảng trong infra/.
 * z.object bỏ các thuộc tính không khai báo, nên `nameSearch` (chỉ dùng để tìm) không lọt ra API.
 */
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

export class DynamoProductRepository implements ProductRepository {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findById(productId: string): Promise<Product | null> {
    const { Item } = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { productId } }),
    );
    if (!Item) return null;
    // Dữ liệu trong bảng sai kiểu thì báo lỗi ngay, không trả dữ liệu hỏng cho web.
    return productItem.parse(Item);
  }
}
