import { NotFoundError } from '../../../shared/errors.js';

export class ProductNotFoundError extends NotFoundError {
  constructor(readonly productId: string) {
    super(`Không tìm thấy sản phẩm ${productId}`);
  }
}
