import { logger } from '../../../shared/logger.js';
import { actionOfPatch, type AdminProductPatch } from '../domain/adminProduct.js';
import {
  InvalidSpecKeysError,
  ProductChangedError,
  ProductNotFoundError,
  StockChangedError,
} from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import { unknownSpecKeys } from '../domain/specKeys.js';
import type { AdminProductWriter, ProductRepository } from '../ports.js';

export interface UpdateAdminProductDeps {
  readonly products: ProductRepository;
  readonly writer: AdminProductWriter;
  readonly now: () => string;
}

export interface UpdateAdminProductInput {
  readonly adminId: string;
  readonly productId: string;
  readonly patch: AdminProductPatch;
  /** `updatedAt` của bản admin đang sửa */
  readonly updatedAt: string;
  /** Tồn kho admin thấy lúc mở form; handler bắt buộc khi có `patch.stock` */
  readonly expectedStock?: number;
}

/** Bản trong bảng khác bản admin đang sửa thì báo lỗi nào (BR-12) */
function conflictOf(current: Product, input: UpdateAdminProductInput): Error | undefined {
  if (current.updatedAt !== input.updatedAt) return new ProductChangedError(current);
  if (input.patch.stock !== undefined && current.stock !== input.expectedStock) {
    return new StockChangedError(current.stock);
  }
  return undefined;
}

/**
 * Admin sửa, ẩn, hiện lại sản phẩm (catalog.md BR-12, BR-13). Đọc bản hiện tại để biết loại hàng
 * (kiểm khoá thông số) và báo lỗi sớm; lệnh ghi vẫn có điều kiện vì bản có thể đổi giữa lúc đọc và
 * lúc ghi. Điều kiện sai thì đọc lại để trả đúng 404, `PRODUCT_CHANGED` hoặc `STOCK_CHANGED`.
 */
export async function updateAdminProduct(
  deps: UpdateAdminProductDeps,
  input: UpdateAdminProductInput,
): Promise<Product> {
  const current = await deps.products.findById(input.productId);
  // Món đã xoá mềm phải khôi phục trước (BR-12)
  if (!current || current.deletedAt !== undefined) {
    throw new ProductNotFoundError(input.productId);
  }
  const unknown = input.patch.specs ? unknownSpecKeys(current.category, input.patch.specs) : [];
  if (unknown.length > 0) throw new InvalidSpecKeysError(unknown);
  const early = conflictOf(current, input);
  if (early) throw early;

  const saved = await deps.writer.update({
    product: current,
    patch: input.patch,
    seenUpdatedAt: input.updatedAt,
    ...(input.patch.stock !== undefined && { expectedStock: input.expectedStock }),
    now: deps.now(),
  });
  if (!saved) {
    // Đọc nhất quán: đọc thường có thể ra bản cũ (vd. tồn kho vừa trừ 12 → 10 mà updatedAt không đổi)
    // rồi trả PRODUCT_CHANGED thay vì STOCK_CHANGED
    const latest = await deps.products.findById(input.productId, { consistent: true });
    if (!latest || latest.deletedAt !== undefined) throw new ProductNotFoundError(input.productId);
    // Không rõ lý do (vd. đổi rồi đổi lại đúng giá trị cũ): coi như vừa được sửa ở nơi khác
    throw conflictOf(latest, input) ?? new ProductChangedError(latest);
  }

  logger.info('Admin sửa sản phẩm', {
    adminId: input.adminId,
    productId: input.productId,
    action: actionOfPatch(input.patch),
  });
  return saved;
}
