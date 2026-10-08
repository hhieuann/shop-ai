import type { CartLine, ProductSnapshot } from './domain/cart.js';

/** Giỏ đọc từ bảng carts, kèm phiên bản để ghi có điều kiện */
export interface StoredCart {
  readonly lines: readonly CartLine[];
  /** Mã phiên bản của lần ghi trước (ngẫu nhiên, đổi mỗi lần ghi); null khi người này chưa có giỏ */
  readonly version: string | null;
}

/** Use case chỉ biết interface này; adapter DynamoDB nằm trong infra/. */
export interface CartRepository {
  get(userId: string): Promise<StoredCart>;
  /**
   * Ghi cả giỏ kèm phiên bản mới, chỉ khi phiên bản trên bảng vẫn là `expectedVersion`
   * (null = chưa có giỏ). Có request khác ghi trước thì ném CartVersionConflictError để
   * use case đọc lại và làm lại.
   */
  save(
    userId: string,
    lines: readonly CartLine[],
    expectedVersion: string | null,
    updatedAt: string,
  ): Promise<void>;
}

/**
 * Thông tin sản phẩm mới nhất (giá, tồn kho, trạng thái) của module catalog.
 * Cart không import code của catalog (ADR-0009); adapter đọc bảng products, chỉ đọc.
 */
export interface ProductCatalog {
  /** Sản phẩm không còn trong catalog thì không có trong Map trả về */
  findMany(productIds: readonly string[]): Promise<Map<string, ProductSnapshot>>;
}

/** Ghi có điều kiện thất bại vì một request khác vừa ghi giỏ này */
export class CartVersionConflictError extends Error {
  constructor(readonly userId: string) {
    super(`Giỏ của ${userId} vừa được cập nhật bởi request khác`);
    this.name = 'CartVersionConflictError';
  }
}
