import { ConflictError, NotFoundError } from '../../../shared/errors.js';

/** Thêm vào giỏ một productId không có trong catalog → 404 (cart.md, Trường hợp đặc biệt). */
export class ProductNotFoundError extends NotFoundError {
  constructor(readonly productId: string) {
    super(`Không tìm thấy sản phẩm ${productId}`);
  }
}

/** Sửa hoặc xoá món không có trong giỏ → 404. */
export class CartItemNotFoundError extends NotFoundError {
  constructor(readonly productId: string) {
    super(`Sản phẩm ${productId} không có trong giỏ`);
  }
}

/** BR-03, BR-04: số lượng vượt min(99, tồn kho) → 409 QUANTITY_LIMIT kèm số còn thêm được. */
export class QuantityLimitError extends ConflictError {
  constructor(readonly maxAddable: number) {
    super(`Chỉ thêm được tối đa ${maxAddable} sản phẩm nữa`, {
      code: 'QUANTITY_LIMIT',
      extensions: { maxAddable },
    });
  }
}

/** Thêm sản phẩm đã ngừng bán → 409 PRODUCT_UNAVAILABLE. */
export class ProductUnavailableError extends ConflictError {
  constructor(readonly productId: string) {
    super(`Sản phẩm ${productId} đã ngừng bán`, { code: 'PRODUCT_UNAVAILABLE' });
  }
}

/** BR-02: giỏ đã đủ 50 dòng mà thêm món mới → 409 CART_FULL. */
export class CartFullError extends ConflictError {
  constructor() {
    super('Giỏ hàng đã đủ 50 sản phẩm', { code: 'CART_FULL' });
  }
}
