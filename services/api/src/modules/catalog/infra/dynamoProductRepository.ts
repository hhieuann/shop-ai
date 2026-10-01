import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { Product } from '../domain/product.js';
import type { ProductRepository } from '../ports.js';

/**
 * Bảng products, khoá chính là `id`. Hoàng thiết kế lại khoá và index khi có truy vấn
 * theo loại, theo giá (ADR-0012). Giữ khớp với test/helpers/catalog.ts và bảng trong infra/.
 */
const productItem = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  priceVnd: z.number().int().nonnegative(),
  stock: z.number().int(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  updatedAt: z.string(),
});

export class DynamoProductRepository implements ProductRepository {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findById(id: string): Promise<Product | null> {
    const { Item } = await this.db.send(new GetCommand({ TableName: this.tableName, Key: { id } }));
    if (!Item) return null;
    // Dữ liệu trong bảng sai kiểu thì báo lỗi ngay, không trả dữ liệu hỏng cho web.
    return productItem.parse(Item);
  }
}
