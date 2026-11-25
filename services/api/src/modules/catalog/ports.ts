import type { AdminProductGroup, AdminProductPatch } from './domain/adminProduct.js';
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

/**
 * Ghi của API admin sản phẩm (catalog.md BR-11 … BR-14, dynamodb-design.md "Ghi của admin").
 * Mọi lệnh ghi có điều kiện; điều kiện sai thì trả `null` để use case đọc lại và báo đúng lỗi.
 * Không có lệnh xoá hẳn khỏi bảng.
 */
export interface AdminProductWriter {
  /** PutItem có điều kiện chưa tồn tại `productId`; ghi kèm `categoryStatus` */
  create(product: Product): Promise<void>;
  /**
   * UpdateItem các trường trong `patch`, `updatedAt = now`; đổi `status` thì đổi `categoryStatus`
   * cùng lệnh. Điều kiện: `updatedAt` bằng `seenUpdatedAt`, chưa xoá mềm, có `expectedStock` thì
   * `stock` bằng nó. Trả bản sau khi ghi, hoặc `null` khi điều kiện sai
   */
  update(input: {
    readonly product: Pick<Product, 'productId' | 'category'>;
    readonly patch: AdminProductPatch;
    readonly seenUpdatedAt: string;
    readonly expectedStock?: number;
    readonly now: string;
  }): Promise<Product | null>;
}
