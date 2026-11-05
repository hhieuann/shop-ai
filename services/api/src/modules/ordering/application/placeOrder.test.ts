import { describe, expect, it, vi } from 'vitest';
import {
  IdempotencyKeyReusedError,
  OrderNotFoundError,
  OutOfStockError,
  TooManyOpenOrdersError,
} from '../domain/errors.js';
import type { Order, ProductSnapshot, ShippingAddress } from '../domain/order.js';
import { payloadHash } from '../domain/placement.js';
import { CartChangedError, type PlaceOrderResult, type StoredCart } from '../ports.js';
import {
  MAX_ATTEMPTS,
  placeOrder,
  type PlaceOrderDeps,
  type PlaceOrderInput,
} from './placeOrder.js';

const NOW = '2026-10-24T03:00:00.000Z';
const ORDER_ID = '01K8ORDERNEW';
const OLD_ORDER_ID = '01K8ORDEROLD';

const ADDRESS: ShippingAddress = {
  fullName: 'Nguyễn Văn A',
  phone: '0912345678',
  address: '12 Nguyễn Huệ, phường Bến Nghé',
  province: 'TP. Hồ Chí Minh',
};

const GPU: ProductSnapshot = {
  productId: 'gpu-1',
  name: 'ASUS TUF RTX 4070',
  price: 15_900_000,
  stock: 10,
  status: 'ACTIVE',
};

const CART: StoredCart = {
  lines: [
    { productId: 'gpu-1', quantity: 2, addedPrice: 15_900_000, addedAt: NOW },
    { productId: 'bag-1', quantity: 1, addedPrice: 350_000, addedAt: NOW },
  ],
  version: 'v1',
};

function input(overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return {
    userId: 'user-1',
    idempotencyKey: 'key-1',
    correlationId: 'corr-1',
    items: [{ productId: 'gpu-1', quantity: 1, expectedPrice: 15_900_000 }],
    shippingAddress: ADDRESS,
    ...overrides,
  };
}

function deps(
  options: {
    products?: ProductSnapshot[];
    cart?: StoredCart;
    place?: () => Promise<PlaceOrderResult>;
    existing?: Order | null;
    enqueue?: () => Promise<void>;
  } = {},
) {
  const products = options.products ?? [GPU];
  const d = {
    catalog: {
      findMany: vi.fn(async () => new Map(products.map((p) => [p.productId, p]))),
    },
    carts: { get: vi.fn(async () => options.cart ?? CART) },
    orders: {
      place: vi.fn(options.place ?? (async (): Promise<PlaceOrderResult> => ({ kind: 'created' }))),
      get: vi.fn(async () => (options.existing === undefined ? null : options.existing)),
    },
    queue: { enqueue: vi.fn(options.enqueue ?? (async () => {})) },
    metrics: { enqueueFailed: vi.fn() },
    newOrderId: () => ORDER_ID,
    now: () => NOW,
  };
  return d satisfies PlaceOrderDeps;
}

/** Bắt lỗi ném ra để kiểm cả loại lỗi lẫn dữ liệu đi kèm */
async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Không ném lỗi');
}

describe('placeOrder', () => {
  it('placeOrder_createsPendingOrderAndEnqueues_whenItemsValid', async () => {
    // Arrange
    const d = deps();

    // Act
    const result = await placeOrder(d, input());

    // Assert
    expect(result.created).toBe(true);
    expect(result.order).toMatchObject({
      orderId: ORDER_ID,
      userId: 'user-1',
      status: 'PENDING',
      totalAmount: 15_900_000,
      shippingFee: 0,
    });

    // Verify: bỏ cả dòng GPU khỏi giỏ dù giỏ có 2 cái (BR-09), giữ túi; gửi đúng 1 tin
    expect(d.orders.place).toHaveBeenCalledTimes(1);
    expect(d.orders.place).toHaveBeenCalledWith({
      order: result.order,
      idempotencyKey: 'key-1',
      payloadHash: payloadHash(input().items, ADDRESS),
      markerExpiresAt: Date.parse(NOW) / 1000 + 24 * 60 * 60,
      cart: { remainingLines: [CART.lines[1]], expectedVersion: 'v1' },
    });
    expect(d.queue.enqueue).toHaveBeenCalledExactlyOnceWith({
      orderId: ORDER_ID,
      userId: 'user-1',
      type: 'PLACED',
      correlationId: 'corr-1',
    });
    expect(d.metrics.enqueueFailed).not.toHaveBeenCalled();
  });

  it('placeOrder_passesNullCart_whenUserHasNoCart', async () => {
    // Arrange
    const d = deps({ cart: { lines: [], version: null } });

    // Act
    await placeOrder(d, input());

    // Assert: không có giỏ thì giao dịch bỏ thao tác ghi giỏ
    expect(d.orders.place).toHaveBeenCalledWith(expect.objectContaining({ cart: null }));
  });

  it('placeOrder_throwsOutOfStock_withoutWriting_whenAnyItemUnavailable', async () => {
    // Arrange
    const d = deps({ products: [{ ...GPU, stock: 0 }] });

    // Act
    const error = await catchError(placeOrder(d, input()));

    // Assert
    expect(error).toBeInstanceOf(OutOfStockError);

    // Verify: lỗi ở bước kiểm, không đọc giỏ, không ghi, không gửi tin
    expect(d.carts.get).not.toHaveBeenCalled();
    expect(d.orders.place).not.toHaveBeenCalled();
    expect(d.queue.enqueue).not.toHaveBeenCalled();
  });

  it('placeOrder_rethrowsBusinessError_fromTransaction', async () => {
    // Arrange: đủ hàng lúc đọc nhưng giao dịch báo đã có 3 đơn mở
    const d = deps({
      place: async () => {
        throw new TooManyOpenOrdersError(3);
      },
    });

    // Act
    const error = await catchError(placeOrder(d, input()));

    // Assert
    expect(error).toBeInstanceOf(TooManyOpenOrdersError);

    // Verify
    expect(d.orders.place).toHaveBeenCalledTimes(1);
    expect(d.queue.enqueue).not.toHaveBeenCalled();
  });

  it('placeOrder_rereadsCartAndRetries_whenCartChanged', async () => {
    // Arrange
    let calls = 0;
    const d = deps({
      place: async () => {
        calls++;
        if (calls === 1) throw new CartChangedError('user-1');
        return { kind: 'created' };
      },
    });

    // Act
    const result = await placeOrder(d, input());

    // Assert
    expect(result.created).toBe(true);

    // Verify: đọc giỏ lại cho lần thử 2, sản phẩm chỉ đọc một lần
    expect(d.carts.get).toHaveBeenCalledTimes(2);
    expect(d.orders.place).toHaveBeenCalledTimes(2);
    expect(d.catalog.findMany).toHaveBeenCalledTimes(1);
  });

  it('placeOrder_throwsCartChanged_afterMaxAttempts', async () => {
    // Arrange
    const d = deps({
      place: async () => {
        throw new CartChangedError('user-1');
      },
    });

    // Act
    const error = await catchError(placeOrder(d, input()));

    // Assert
    expect(error).toBeInstanceOf(CartChangedError);

    // Verify
    expect(d.orders.place).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it('placeOrder_returnsExistingOrderAndReenqueues_whenMarkerHasSameHash', async () => {
    // Arrange: lần trước đã ghi xong giao dịch rồi mới lỗi
    const old = { orderId: OLD_ORDER_ID, userId: 'user-1' } as Order;
    const d = deps({
      place: async () => ({
        kind: 'existing',
        orderId: OLD_ORDER_ID,
        payloadHash: payloadHash(input().items, ADDRESS),
      }),
      existing: old,
    });

    // Act
    const result = await placeOrder(d, input());

    // Assert
    expect(result).toEqual({ order: old, created: false });

    // Verify: đọc đúng đơn cũ, gửi lại tin cho đơn cũ
    expect(d.orders.get).toHaveBeenCalledExactlyOnceWith('user-1', OLD_ORDER_ID);
    expect(d.queue.enqueue).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ orderId: OLD_ORDER_ID }),
    );
  });

  it('placeOrder_throwsIdempotencyKeyReused_whenMarkerHasDifferentHash', async () => {
    // Arrange
    const d = deps({
      place: async () => ({ kind: 'existing', orderId: OLD_ORDER_ID, payloadHash: 'khac' }),
    });

    // Act
    const error = await catchError(placeOrder(d, input()));

    // Assert
    expect(error).toBeInstanceOf(IdempotencyKeyReusedError);
    expect((error as IdempotencyKeyReusedError).code).toBe('IDEMPOTENCY_KEY_REUSED');

    // Verify
    expect(d.orders.get).not.toHaveBeenCalled();
    expect(d.queue.enqueue).not.toHaveBeenCalled();
  });

  it('placeOrder_throwsNotFound_whenMarkerPointsToMissingOrder', async () => {
    // Arrange
    const d = deps({
      place: async () => ({
        kind: 'existing',
        orderId: OLD_ORDER_ID,
        payloadHash: payloadHash(input().items, ADDRESS),
      }),
      existing: null,
    });

    // Act
    const error = await catchError(placeOrder(d, input()));

    // Assert
    expect(error).toBeInstanceOf(OrderNotFoundError);
  });

  it('placeOrder_stillReturnsOrderAndCountsMetric_whenEnqueueFails', async () => {
    // Arrange
    const d = deps({
      enqueue: async () => {
        throw new Error('SQS không trả lời');
      },
    });

    // Act
    const result = await placeOrder(d, input());

    // Assert: đơn đã ghi, khách không phải đặt lại (ordering.md, luồng SQS bước 1)
    expect(result.created).toBe(true);
    expect(result.order.orderId).toBe(ORDER_ID);

    // Verify
    expect(d.metrics.enqueueFailed).toHaveBeenCalledTimes(1);
  });
});
