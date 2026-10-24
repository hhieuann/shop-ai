import { logger } from '../../../shared/logger.js';
import { IdempotencyKeyReusedError, OrderNotFoundError } from '../domain/errors.js';
import {
  buildOrder,
  type Order,
  type RequestedItem,
  type ShippingAddress,
} from '../domain/order.js';
import { markerExpiresAt, payloadHash, remainingCartLines } from '../domain/placement.js';
import {
  CartChangedError,
  type CartReader,
  type OrderMetrics,
  type OrderQueue,
  type OrderStore,
  type ProductCatalog,
} from '../ports.js';

export interface PlaceOrderDeps {
  readonly catalog: ProductCatalog;
  readonly carts: CartReader;
  readonly orders: OrderStore;
  readonly queue: OrderQueue;
  readonly metrics: OrderMetrics;
  /** ULID cho orderId; test truyền giá trị cố định */
  readonly newOrderId: () => string;
  /** ISO 8601 UTC; test truyền giờ cố định */
  readonly now: () => string;
}

export interface PlaceOrderInput {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly items: readonly RequestedItem[];
  readonly shippingAddress: ShippingAddress;
}

export interface PlaceOrderOutput {
  readonly order: Order;
  /** false khi khoá này đã tạo đơn ở lần gọi trước (item đánh dấu): handler trả 200 thay vì 201 */
  readonly created: boolean;
}

/** Giỏ đổi phiên bản giữa lúc đọc và ghi (2 tab, sửa giỏ đúng lúc đặt): đọc lại, tối đa từng này lần */
export const MAX_ATTEMPTS = 3;

/**
 * POST /api/v1/orders (ordering.md BR-01 … BR-09, BR-14; dynamodb-design.md, giao dịch đặt hàng):
 * 1. đọc sản phẩm, kiểm từng món (OUT_OF_STOCK trước PRICE_CHANGED); lỗi thì không ghi gì;
 * 2. đọc giỏ, bỏ cả dòng các món đã đặt;
 * 3. một giao dịch: trừ kho, ghi đơn, ghi giỏ còn lại, tăng `#OPEN`, ghi item đánh dấu;
 * 4. gửi tin cho worker; gửi lỗi thì vẫn trả đơn (đơn đã ghi), ghi log và metric để xử lý theo runbook.
 */
export async function placeOrder(
  deps: PlaceOrderDeps,
  input: PlaceOrderInput,
): Promise<PlaceOrderOutput> {
  const hash = payloadHash(input.items, input.shippingAddress);
  const productIds = input.items.map((item) => item.productId);
  const products = await deps.catalog.findMany(productIds);
  const now = deps.now();
  const order = buildOrder({
    orderId: deps.newOrderId(),
    userId: input.userId,
    requested: input.items,
    products,
    shippingAddress: input.shippingAddress,
    now,
  });

  for (let attempt = 1; ; attempt++) {
    const cart = await deps.carts.get(input.userId);
    try {
      const result = await deps.orders.place({
        order,
        idempotencyKey: input.idempotencyKey,
        payloadHash: hash,
        markerExpiresAt: markerExpiresAt(now),
        cart:
          cart.version === null
            ? null
            : {
                remainingLines: remainingCartLines(cart.lines, productIds),
                expectedVersion: cart.version,
              },
      });
      if (result.kind === 'created') {
        await enqueue(deps, order, input.correlationId);
        return { order, created: true };
      }
      return await existingOrder(deps, input, result.orderId, result.payloadHash === hash);
    } catch (error) {
      if (!(error instanceof CartChangedError) || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}

/**
 * Khoá đã tạo đơn ở lần trước, và giao dịch đó đã ghi xong (lỗi hoặc timeout sau commit làm
 * Powertools quên kết quả). Cùng nội dung: trả đơn cũ và gửi lại tin, vì lần trước có thể chưa gửi
 * được; worker chống trùng theo orderId nên gửi lại không hại. Khác nội dung: 422.
 */
async function existingOrder(
  deps: PlaceOrderDeps,
  input: PlaceOrderInput,
  orderId: string,
  samePayload: boolean,
): Promise<PlaceOrderOutput> {
  if (!samePayload) throw new IdempotencyKeyReusedError();
  const order = await deps.orders.get(input.userId, orderId);
  // Item đánh dấu luôn ghi cùng giao dịch với đơn, nên thiếu đơn là dữ liệu hỏng: báo 404 cho rõ
  if (!order) throw new OrderNotFoundError(orderId);
  await enqueue(deps, order, input.correlationId);
  return { order, created: false };
}

/** Gửi tin lỗi không làm hỏng request: đơn đã ghi, khách không phải đặt lại (ordering.md, luồng SQS bước 1) */
async function enqueue(deps: PlaceOrderDeps, order: Order, correlationId: string): Promise<void> {
  try {
    await deps.queue.enqueue({
      orderId: order.orderId,
      userId: order.userId,
      type: 'PLACED',
      correlationId,
    });
  } catch (error) {
    // Chỉ ghi mã đơn và correlationId, không ghi địa chỉ, SĐT (O8)
    logger.error('Không gửi được tin đơn hàng cho worker', {
      error,
      orderId: order.orderId,
      correlationId,
    });
    deps.metrics.enqueueFailed();
  }
}
