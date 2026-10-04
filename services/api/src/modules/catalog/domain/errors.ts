import { BadRequestError, NotFoundError } from '../../../shared/errors.js';

export class ProductNotFoundError extends NotFoundError {
  constructor(readonly productId: string) {
    super(`Không tìm thấy sản phẩm ${productId}`);
  }
}

/** Cursor phân trang sai định dạng, quá dài hoặc tạo từ cách sắp xếp khác → 400. */
export class InvalidCursorError extends BadRequestError {
  constructor() {
    super('Con trỏ phân trang không hợp lệ');
  }
}
