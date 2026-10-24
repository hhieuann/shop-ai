import type { Order, ProductSnapshot } from './domain/order.js';

/**
 * Thông tin sản phẩm mới nhất của module catalog (tên, giá, tồn kho, trạng thái).
 * Ordering không import code của catalog (ADR-0009); adapter đọc bảng products bằng
 * BatchGetItem, chỉ đọc (ADR-0017, sửa 24/10).
 */
export interface ProductCatalog {
  /** Sản phẩm không còn trong catalog thì không có trong Map trả về */
  findMany(productIds: readonly string[]): Promise<Map<string, ProductSnapshot>>;
}

/**
 * Một dòng giỏ đúng như bảng carts của module cart lưu. Ordering không đọc nghĩa các trường,
 * chỉ giữ nguyên để ghi lại các dòng chưa đặt (ADR-0017: cart đổi schema thì sửa cả ordering).
 */
export interface CartLineRecord {
  readonly productId: string;
  readonly quantity: number;
  readonly addedPrice: number;
  readonly addedAt: string;
}

/** Giỏ đọc từ bảng carts kèm phiên bản; `version` null khi người này chưa có giỏ */
export interface StoredCart {
  readonly lines: readonly CartLineRecord[];
  readonly version: string | null;
}

/** Đọc giỏ của module cart (GetItem, ADR-0017) */
export interface CartReader {
  get(userId: string): Promise<StoredCart>;
}

/** Một lần ghi giao dịch đặt hàng (dynamodb-design.md, giao dịch đặt hàng, n + 4 thao tác) */
export interface PlaceOrderCommand {
  readonly order: Order;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  /** Epoch giây hết hạn của item đánh dấu `#KEY#<idempotencyKey>` */
  readonly markerExpiresAt: number;
  /** Giỏ sau khi bỏ món đã đặt và phiên bản lúc đọc; null khi người này chưa có giỏ */
  readonly cart: {
    readonly remainingLines: readonly CartLineRecord[];
    readonly expectedVersion: string;
  } | null;
}

/** Kết quả ghi: đơn mới, hoặc item đánh dấu đã có (đơn đã tạo ở lần gọi trước với cùng khoá) */
export type PlaceOrderResult =
  | { readonly kind: 'created' }
  | { readonly kind: 'existing'; readonly orderId: string; readonly payloadHash: string };

/**
 * Bảng orders của ordering. `place` ghi đơn, trừ kho, bỏ món khỏi giỏ, tăng bộ đếm `#OPEN` và
 * ghi item đánh dấu trong một giao dịch. Lỗi nghiệp vụ: OutOfStockError, PriceChangedError,
 * TooManyOpenOrdersError; giỏ đổi phiên bản giữa lúc đọc và ghi: CartChangedError.
 */
export interface OrderStore {
  place(command: PlaceOrderCommand): Promise<PlaceOrderResult>;
  get(userId: string, orderId: string): Promise<Order | null>;
}

/** Tin gửi worker order-processor (ordering.md, luồng SQS); không có dữ liệu cá nhân (O8) */
export interface OrderMessage {
  readonly orderId: string;
  readonly userId: string;
  readonly type: 'PLACED' | 'CANCELLED';
  readonly correlationId: string;
}

export interface OrderQueue {
  enqueue(message: OrderMessage): Promise<void>;
}

/** Metric nghiệp vụ; alarm `order-enqueue-failed` chỉ ở prod */
export interface OrderMetrics {
  enqueueFailed(): void;
}

/** Giỏ vừa bị request khác ghi (điều kiện `version` của giao dịch sai): đọc lại giỏ, thử lại */
export class CartChangedError extends Error {
  constructor(readonly userId: string) {
    super(`Giỏ của ${userId} vừa đổi trong lúc đặt hàng`);
    this.name = 'CartChangedError';
  }
}
