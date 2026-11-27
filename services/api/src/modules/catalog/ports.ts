import type { AdminProductGroup } from './domain/adminProduct.js';
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

/** Đọc cho API admin sản phẩm (catalog.md BR-10). Chi tiết dùng ProductRepository.findById. */
export interface AdminProductReader {
  /**
   * Mọi món của một loại trong một nhóm, đã đọc hết các trang.
   * Hiện thực: Query GSI `byCategory` với khoá `<category>#<group>`, không Scan.
   */
  listByGroup(category: ProductCategory, group: AdminProductGroup): Promise<Product[]>;
  /** Số món của một loại trong một nhóm: Query cùng khoá với `Select: COUNT` */
  countByGroup(category: ProductCategory, group: AdminProductGroup): Promise<number>;
}
