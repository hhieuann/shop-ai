import { logger } from '../../../shared/logger.js';
import { newProduct, type AdminProductDraft } from '../domain/adminProduct.js';
import { InvalidSpecKeysError } from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import { unknownSpecKeys } from '../domain/specKeys.js';
import type { AdminProductWriter } from '../ports.js';

export interface CreateAdminProductDeps {
  readonly writer: AdminProductWriter;
  /** Sinh ULID mới */
  readonly newId: () => string;
  /** ISO 8601 UTC */
  readonly now: () => string;
}

/**
 * Admin thêm sản phẩm (catalog.md BR-11): khoá thông số phải thuộc loại hàng; server sinh
 * `productId`, `createdAt` bằng `updatedAt`. Trùng tên được phép.
 */
export async function createAdminProduct(
  deps: CreateAdminProductDeps,
  input: { readonly adminId: string; readonly draft: AdminProductDraft },
): Promise<Product> {
  const { draft } = input;
  const unknown = draft.specs ? unknownSpecKeys(draft.category, draft.specs) : [];
  if (unknown.length > 0) throw new InvalidSpecKeysError(unknown);

  const product = newProduct(draft, deps.newId(), deps.now());
  await deps.writer.create(product);
  logger.info('Admin thêm sản phẩm', {
    adminId: input.adminId,
    productId: product.productId,
    action: 'CREATE',
  });
  return product;
}
