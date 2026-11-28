import { logger } from '../../../shared/logger.js';
import { ProductNotFoundError } from '../domain/errors.js';
import type { AdminProductWriter, ProductRepository } from '../ports.js';

export interface SoftDeleteDeps {
  readonly products: ProductRepository;
  readonly writer: AdminProductWriter;
  readonly now: () => string;
}

/**
 * Admin xoá sản phẩm (catalog.md BR-14): xoá mềm, không xoá khỏi bảng. Không có hoặc đã xoá → 404.
 */
export async function deleteAdminProduct(
  deps: SoftDeleteDeps,
  input: { readonly adminId: string; readonly productId: string },
): Promise<void> {
  const current = await deps.products.findById(input.productId);
  if (!current || current.deletedAt !== undefined) {
    throw new ProductNotFoundError(input.productId);
  }
  // Điều kiện chưa xoá: hai admin cùng xoá thì người sau nhận 404
  const deleted = await deps.writer.softDelete(current, deps.now());
  if (!deleted) throw new ProductNotFoundError(input.productId);
  logger.info('Admin xoá sản phẩm', {
    adminId: input.adminId,
    productId: input.productId,
    action: 'DELETE',
  });
}
