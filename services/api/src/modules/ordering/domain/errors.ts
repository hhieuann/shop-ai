import { ConflictError, NotFoundError, UnprocessableError } from '../../../shared/errors.js';

/** Món không đặt được: số còn đặt được, 0 khi hết hàng, ngừng bán hoặc không còn trong catalog */
export interface InvalidItem {
  readonly productId: string;
  readonly available: number;
}

/** Món đã đổi giá so với giá khách đang thấy */
export interface ChangedItem {
  readonly productId: string;
  readonly expectedPrice: number;
  readonly currentPrice: number;
}

/** BR-03, BR-08: có món hết hàng, không đủ số lượng hoặc ngừng bán → 409 OUT_OF_STOCK kèm invalidItems. */
export class OutOfStockError extends ConflictError {
  constructor(readonly invalidItems: readonly InvalidItem[]) {
    super('Có sản phẩm không đủ hàng hoặc đã ngừng bán', {
      code: 'OUT_OF_STOCK',
      extensions: { invalidItems },
    });
  }
}

/** BR-07: giá hiện tại khác giá khách đã thấy → 409 PRICE_CHANGED kèm changedItems, không tạo đơn. */
export class PriceChangedError extends ConflictError {
  constructor(readonly changedItems: readonly ChangedItem[]) {
    super('Giá sản phẩm đã thay đổi, vui lòng xem lại', {
      code: 'PRICE_CHANGED',
      extensions: { changedItems },
    });
  }
}

/** BR-14: đã có đủ đơn đang mở (PENDING, CONFIRMED) → 409 TOO_MANY_OPEN_ORDERS, không trừ kho. */
export class TooManyOpenOrdersError extends ConflictError {
  constructor(readonly maxOpenOrders: number) {
    super(`Bạn đang có ${maxOpenOrders} đơn chưa giao`, { code: 'TOO_MANY_OPEN_ORDERS' });
  }
}

/**
 * BR-04: cùng Idempotency-Key đã tạo đơn nhưng nội dung khác → 422, cùng mã với lỗi Powertools
 * (shared/idempotency.ts). Lỗi này đến từ item đánh dấu khi bản ghi Powertools đã không còn.
 */
export class IdempotencyKeyReusedError extends UnprocessableError {
  constructor() {
    super('Idempotency-Key đã dùng cho nội dung khác', { code: 'IDEMPOTENCY_KEY_REUSED' });
  }
}

/** Đơn không có hoặc của người khác → 404, không để lộ đơn đó có tồn tại (ordering.md, Trường hợp đặc biệt). */
export class OrderNotFoundError extends NotFoundError {
  constructor(readonly orderId: string) {
    super(`Không tìm thấy đơn ${orderId}`);
  }
}

/** BR-10, BR-11: đơn ở trạng thái không huỷ được → 409 CANNOT_CANCEL. */
export class CannotCancelError extends ConflictError {
  constructor(readonly orderId: string) {
    super(`Đơn ${orderId} không huỷ được ở trạng thái hiện tại`, { code: 'CANNOT_CANCEL' });
  }
}
