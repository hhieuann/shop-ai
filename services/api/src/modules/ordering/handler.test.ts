import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import { ConflictError } from '../../shared/errors.js';
import {
  CannotCancelError,
  IdempotencyKeyReusedError,
  InvalidOrderCursorError,
  OrderNotFoundError,
  OutOfStockError,
  PriceChangedError,
  TooManyOpenOrdersError,
} from './domain/errors.js';
import type { Order } from './domain/order.js';
import { makeHandler } from './handler.js';
import type { OrderingUseCases } from './routes.js';

const CREATE = 'POST /api/v1/orders';
const LIST = 'GET /api/v1/orders';
const DETAIL = 'GET /api/v1/orders/{orderId}';
const CANCEL = 'DELETE /api/v1/orders/{orderId}';
/** Idempotency-Key sinh lúc chạy (UUID); không viết cứng chuỗi trông như khoá để gitleaks không báo nhầm */
const IDEMPOTENCY_HEADER = randomUUID();
const USER = 'user-sub-1';
const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';

const ADDRESS = {
  fullName: 'Nguyễn Văn A',
  phone: '0912345678',
  address: '12 Nguyễn Huệ, phường Bến Nghé',
  province: 'TP. Hồ Chí Minh',
};

const BODY = {
  items: [{ productId: PRODUCT_ID, quantity: 1, expectedPrice: 15_900_000 }],
  shippingAddress: ADDRESS,
};

const ORDER: Order = {
  orderId: '01K8ORDER0000000000000001',
  userId: USER,
  status: 'PENDING',
  items: [{ productId: PRODUCT_ID, name: 'ASUS TUF RTX 4070', price: 15_900_000, quantity: 1 }],
  totalAmount: 15_900_000,
  shippingFee: 0,
  shippingAddress: ADDRESS,
  paymentMethod: 'COD',
  createdAt: '2026-10-25T03:00:00.000Z',
  updatedAt: '2026-10-25T03:00:00.000Z',
};

const SUMMARY = {
  orderId: ORDER.orderId,
  status: ORDER.status,
  totalAmount: ORDER.totalAmount,
  itemCount: 1,
  createdAt: ORDER.createdAt,
};

function useCases(result = { value: { order: ORDER, created: true }, replayed: false }) {
  return {
    placeOrder: vi.fn().mockResolvedValue(result),
    listOrders: vi.fn().mockResolvedValue({ items: [SUMMARY], nextCursor: 'next' }),
    getOrder: vi.fn().mockResolvedValue(ORDER),
    cancelOrder: vi.fn().mockResolvedValue({ ...ORDER, status: 'CANCELLED' }),
  } satisfies OrderingUseCases;
}

function createEvent(
  overrides: { body?: unknown; headers?: Record<string, string>; userId?: string } = {},
) {
  return apiEvent({
    routeKey: CREATE,
    userId: 'userId' in overrides ? overrides.userId : USER,
    headers: overrides.headers ?? { 'idempotency-key': IDEMPOTENCY_HEADER },
    body: 'body' in overrides ? overrides.body : BODY,
  });
}

describe('ordering handler · POST /api/v1/orders', () => {
  it('createOrder_returns201NoStore_whenNewOrder', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(createEvent());

    // Assert
    expect(res.statusCode).toBe(201);
    expect(res.headers?.['cache-control']).toBe('no-store');
    expect(parseBody(res)).toEqual(ORDER);

    // Verify: userId từ token, correlationId là requestId, khoá đã chuẩn hoá chữ thường
    expect(cases.placeOrder).toHaveBeenCalledExactlyOnceWith(
      {
        userId: USER,
        idempotencyKey: IDEMPOTENCY_HEADER.toLowerCase(),
        correlationId: 'req-test',
        ...BODY,
      },
      undefined,
    );
  });

  it.each([
    ['Powertools trả lại kết quả cũ', { value: { order: ORDER, created: true }, replayed: true }],
    ['item đánh dấu trả đơn cũ', { value: { order: ORDER, created: false }, replayed: false }],
  ])('createOrder_returns200SameOrder_whenReplayed (%s)', async (_label, result) => {
    // Arrange
    const handler = makeHandler(useCases(result));

    // Act
    const res = await handler(createEvent());

    // Assert
    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual(ORDER);
  });

  it('createOrder_returns400_whenIdempotencyKeyMissing', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(createEvent({ headers: {} }));

    // Assert
    expect(res.statusCode).toBe(400);
    expect(res.headers?.['content-type']).toBe('application/problem+json');

    // Verify
    expect(cases.placeOrder).not.toHaveBeenCalled();
  });

  it('createOrder_returns400WithFieldErrors_whenBodyInvalid', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(
      createEvent({
        body: {
          items: [
            { productId: PRODUCT_ID, quantity: 0, expectedPrice: 1 },
            { productId: PRODUCT_ID, quantity: 1, expectedPrice: 1 },
          ],
          shippingAddress: { ...ADDRESS, phone: '12345' },
        },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(400);
    const fields = (parseBody(res) as { errors: { field: string }[] }).errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(['items.0.quantity', 'items', 'shippingAddress.phone']),
    );

    // Verify
    expect(cases.placeOrder).not.toHaveBeenCalled();
  });

  it('createOrder_returns400_whenBodyNotJson', async () => {
    // Arrange
    const handler = makeHandler(useCases());
    const event = createEvent();

    // Act
    const res = await handler({ ...event, body: '{khong-phai-json' });

    // Assert
    expect(res.statusCode).toBe(400);
  });

  it('createOrder_returns401_whenNoToken', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(createEvent({ userId: undefined }));

    // Assert
    expect(res.statusCode).toBe(401);

    // Verify
    expect(cases.placeOrder).not.toHaveBeenCalled();
  });

  it.each([
    [
      'OUT_OF_STOCK',
      new OutOfStockError([{ productId: PRODUCT_ID, available: 0 }]),
      409,
      { invalidItems: [{ productId: PRODUCT_ID, available: 0 }] },
    ],
    [
      'PRICE_CHANGED',
      new PriceChangedError([{ productId: PRODUCT_ID, expectedPrice: 1, currentPrice: 2 }]),
      409,
      { changedItems: [{ productId: PRODUCT_ID, expectedPrice: 1, currentPrice: 2 }] },
    ],
    ['TOO_MANY_OPEN_ORDERS', new TooManyOpenOrdersError(3), 409, {}],
    ['ORDER_IN_PROGRESS', new ConflictError('chưa xong', { code: 'ORDER_IN_PROGRESS' }), 409, {}],
    ['IDEMPOTENCY_KEY_REUSED', new IdempotencyKeyReusedError(), 422, {}],
  ])('createOrder_returnsProblemWithCode_%s', async (code, error, status, extensions) => {
    // Arrange
    const cases = useCases();
    cases.placeOrder.mockRejectedValue(error);
    const handler = makeHandler(cases);

    // Act
    const res = await handler(createEvent());

    // Assert
    expect(res.statusCode).toBe(status);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    expect(parseBody(res)).toMatchObject({ code, traceId: 'req-test', ...extensions });
  });

  it('createOrder_returns500WithoutDetails_whenUnexpectedError', async () => {
    // Arrange
    const cases = useCases();
    cases.placeOrder.mockRejectedValue(new Error('bảng orders không tồn tại'));
    const handler = makeHandler(cases);

    // Act
    const res = await handler(createEvent());

    // Assert: không lộ chi tiết lỗi ra ngoài (RFC 9457, chỉ có traceId)
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(parseBody(res))).not.toContain('bảng orders');
  });
});

describe('ordering handler · GET /api/v1/orders', () => {
  it('listOrders_returns200NoStore_withUserFromToken', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(
      apiEvent({ routeKey: LIST, userId: USER, query: { limit: '10', cursor: 'abc' } }),
    );

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('no-store');
    expect(parseBody(res)).toEqual({ items: [SUMMARY], nextCursor: 'next' });

    // Verify: limit đổi sang số, userId từ token
    expect(cases.listOrders).toHaveBeenCalledExactlyOnceWith({
      userId: USER,
      limit: 10,
      cursor: 'abc',
    });
  });

  it.each([
    ['limit 0', { limit: '0' }],
    ['limit 51', { limit: '51' }],
    ['limit không phải số', { limit: 'abc' }],
    ['limit lẻ', { limit: '2.5' }],
    ['cursor quá dài', { cursor: 'a'.repeat(201) }],
  ])('listOrders_returns400_when%s', async (_label, query) => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(apiEvent({ routeKey: LIST, userId: USER, query }));

    // Assert
    expect(res.statusCode).toBe(400);
    expect(res.headers?.['content-type']).toBe('application/problem+json');

    // Verify
    expect(cases.listOrders).not.toHaveBeenCalled();
  });

  it('listOrders_returns400_whenCursorCannotBeDecoded', async () => {
    // Arrange
    const cases = useCases();
    cases.listOrders.mockRejectedValue(new InvalidOrderCursorError());
    const handler = makeHandler(cases);

    // Act
    const res = await handler(apiEvent({ routeKey: LIST, userId: USER, query: { cursor: 'x' } }));

    // Assert
    expect(res.statusCode).toBe(400);
  });

  it('listOrders_returns401_whenNoToken', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(apiEvent({ routeKey: LIST }));

    // Assert
    expect(res.statusCode).toBe(401);

    // Verify
    expect(cases.listOrders).not.toHaveBeenCalled();
  });
});

describe('ordering handler · GET /api/v1/orders/{orderId}', () => {
  it('getOrder_returns200NoStore_withUserFromToken', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(
      apiEvent({ routeKey: DETAIL, userId: USER, pathParameters: { orderId: ORDER.orderId } }),
    );

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('no-store');
    expect(parseBody(res)).toEqual(ORDER);

    // Verify
    expect(cases.getOrder).toHaveBeenCalledExactlyOnceWith({
      userId: USER,
      orderId: ORDER.orderId,
    });
  });

  it('getOrder_returns404_whenNotFoundOrSomeoneElses', async () => {
    // Arrange
    const cases = useCases();
    cases.getOrder.mockRejectedValue(new OrderNotFoundError(ORDER.orderId));
    const handler = makeHandler(cases);

    // Act
    const res = await handler(
      apiEvent({ routeKey: DETAIL, userId: USER, pathParameters: { orderId: ORDER.orderId } }),
    );

    // Assert
    expect(res.statusCode).toBe(404);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
  });
});

describe('ordering handler · DELETE /api/v1/orders/{orderId}', () => {
  function cancelEvent(options: { userId?: string } = { userId: USER }) {
    const { userId } = options;
    return apiEvent({ routeKey: CANCEL, userId, pathParameters: { orderId: ORDER.orderId } });
  }

  it('cancelOrder_returns200NoStore_withUserFromToken', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(cancelEvent());

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('no-store');
    expect(parseBody(res)).toEqual({ ...ORDER, status: 'CANCELLED' });

    // Verify: userId từ token, correlationId là requestId
    expect(cases.cancelOrder).toHaveBeenCalledExactlyOnceWith({
      userId: USER,
      orderId: ORDER.orderId,
      correlationId: 'req-test',
    });
  });

  it.each([
    ['CANNOT_CANCEL', new CannotCancelError(ORDER.orderId), 409],
    ['không có hoặc của người khác', new OrderNotFoundError(ORDER.orderId), 404],
  ])('cancelOrder_returnsProblem_when%s', async (_label, error, status) => {
    // Arrange
    const cases = useCases();
    cases.cancelOrder.mockRejectedValue(error);
    const handler = makeHandler(cases);

    // Act
    const res = await handler(cancelEvent());

    // Assert
    expect(res.statusCode).toBe(status);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    if (status === 409) expect(parseBody(res)).toMatchObject({ code: 'CANNOT_CANCEL' });
  });

  it('cancelOrder_returns401_whenNoToken', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(cancelEvent({}));

    // Assert
    expect(res.statusCode).toBe(401);

    // Verify
    expect(cases.cancelOrder).not.toHaveBeenCalled();
  });
});

describe('ordering handler · route lạ', () => {
  it('route_returns404_whenUnknownRoute', async () => {
    // Arrange
    const handler = makeHandler(useCases());

    // Act
    const res = await handler(apiEvent({ routeKey: 'PATCH /api/v1/orders', userId: USER }));

    // Assert
    expect(res.statusCode).toBe(404);
  });
});
