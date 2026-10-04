import type { Product, ProductCategory } from './domain/product.js';

/** Use case chỉ biết interface này; adapter DynamoDB nằm trong infra/. */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
}

/** Đọc danh sách cho GET /api/v1/products. */
export interface ProductListReader {
  /**
   * Mọi sản phẩm ACTIVE của một loại, đã đọc hết các trang.
   * Hiện thực: Query GSI `byCategory` với khoá `<category>#ACTIVE`, không dùng Scan.
   */
  listActiveByCategory(category: ProductCategory): Promise<Product[]>;
}
