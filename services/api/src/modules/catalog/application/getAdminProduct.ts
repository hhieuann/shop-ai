import { ProductNotFoundError } from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import type { ProductRepository } from '../ports.js';

export interface GetAdminProductDeps {
  readonly products: ProductRepository;
}

/**
 * Chi tiết cho admin (catalog.md BR-10, BR-14): trả cả món đã ẩn và món đã xoá mềm (có `deletedAt`).
 * Chỉ không có trong bảng mới là 404.
 */
export async function getAdminProduct(
  deps: GetAdminProductDeps,
  input: { readonly productId: string },
): Promise<Product> {
  const product = await deps.products.findById(input.productId);
  if (!product) throw new ProductNotFoundError(input.productId);
  return product;
}
