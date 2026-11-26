import { BadRequestError, ConflictError, NotFoundError } from '../../../shared/errors.js';
import type { Product } from './product.js';

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

/** Khoá `specs` không thuộc loại hàng (catalog.md BR-11) → 400 kèm `errors` theo từng khoá */
export class InvalidSpecKeysError extends BadRequestError {
  constructor(readonly keys: readonly string[]) {
    super('Thông số không thuộc loại hàng này', {
      extensions: {
        errors: keys.map((key) => ({
          field: `specs.${key}`,
          message: 'Khoá không thuộc loại hàng',
        })),
      },
    });
  }
}

/** Sản phẩm vừa được sửa ở nơi khác: `updatedAt` gửi lên khác bản trong bảng (BR-12) → 409 */
export class ProductChangedError extends ConflictError {
  constructor(readonly current: Product) {
    super('Sản phẩm vừa được sửa ở nơi khác. Tải bản mới rồi sửa lại.', {
      code: 'PRODUCT_CHANGED',
      extensions: { current },
    });
  }
}

/** Tồn kho vừa đổi (vd. khách vừa đặt hàng): `expectedStock` khác tồn kho hiện tại (BR-12) → 409 */
export class StockChangedError extends ConflictError {
  constructor(readonly currentStock: number) {
    super('Tồn kho vừa đổi. Kiểm lại số tồn kho rồi lưu lại.', {
      code: 'STOCK_CHANGED',
      extensions: { currentStock },
    });
  }
}
