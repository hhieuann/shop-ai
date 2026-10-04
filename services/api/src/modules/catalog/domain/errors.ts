import { NotFoundError } from '../../../shared/errors.js';

export class ProductNotFoundError extends NotFoundError {
  constructor(readonly productId: string) {
    super(`Không tìm thấy sản phẩm ${productId}`);
  }
}

/**
 * Cursor phân trang sai định dạng, quá dài hoặc tạo từ cách sắp xếp khác.
 * API trả 400: khi làm route GET /api/v1/products sẽ thêm loại lỗi 400 vào shared/errors.ts.
 */
export class InvalidCursorError extends Error {
  readonly code = 'INVALID_CURSOR';

  constructor() {
    super('Con trỏ phân trang không hợp lệ');
    this.name = 'InvalidCursorError';
  }
}
