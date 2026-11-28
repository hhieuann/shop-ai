import { logger } from '../../../shared/logger.js';
import { ProductNotFoundError } from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import type { SoftDeleteDeps } from './deleteAdminProduct.js';

/**
 * Admin khôi phục sản phẩm đã xoá (catalog.md BR-14): bỏ `deletedAt`, về trạng thái đã ẩn; muốn
 * bán lại thì hiện lại. Không có hoặc chưa xoá → 404.
 */
export async function restoreAdminProduct(
  deps: SoftDeleteDeps,
  input: { readonly adminId: string; readonly productId: string },
): Promise<Product> {
  const current = await deps.products.findById(input.productId);
  if (!current || current.deletedAt === undefined) {
    throw new ProductNotFoundError(input.productId);
  }
  const restored = await deps.writer.restore(current, deps.now());
  if (!restored) throw new ProductNotFoundError(input.productId);
  logger.info('Admin khôi phục sản phẩm', {
    adminId: input.adminId,
    productId: input.productId,
    action: 'RESTORE',
  });
  return restored;
}
