import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import type { CartView } from './domain/cart.js';
import {
  CartFullError,
  CartItemNotFoundError,
  ProductNotFoundError,
  ProductUnavailableError,
  QuantityLimitError,
} from './domain/errors.js';
import { UnprocessableError, ConflictError } from '../../shared/errors.js';
import { makeHandler } from './handler.js';
import type { CartUseCases } from './routes.js';

const GET_CART = 'GET /api/v1/cart';
const ADD_ITEM = 'POST /api/v1/cart/items';
const UPDATE_ITEM = 'PUT /api/v1/cart/items/{productId}';
const REMOVE_ITEM = 'DELETE /api/v1/cart/items/{productId}';
const MERGE = 'POST /api/v1/cart/merge';
/** Idempotency-Key sinh lúc chạy (UUID); không viết cứng chuỗi trông như khoá để gitleaks không báo nhầm */
const IDEMPOTENCY_HEADER = randomUUID();
const USER = 'user-sub-1';
const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';

const view: CartView = {
  items: [
    {
      productId: PRODUCT_ID,
      name: 'ASUS TUF RTX 4070',
      price: 15_900_000,
      quantity: 2,
      stock: 10,
      status: 'ACTIVE',
      priceChanged: false,
    },
  ],
  totalAmount: 31_800_000,
};

/** Mọi use case là mock trả về `view`; test nào cần thì ghi đè */
function useCases(overrides: Partial<CartUseCases> = {}): CartUseCases {
  return {
    getCart: vi.fn().mockResolvedValue(view),
    addCartItem: vi.fn().mockResolvedValue(view),
    updateCartItem: vi.fn().mockResolvedValue(view),
    removeCartItem: vi.fn().mockResolvedValue(view),
    mergeCart: vi.fn().mockResolvedValue({
      value: { cart: view, mergedExisting: [], adjustments: [] },
      replayed: false,
    }),
    ...overrides,
  };
}

describe('cart handler', () => {
  it('getCart_returns200NoStore_whenSignedIn', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(apiEvent({ routeKey: GET_CART, userId: USER }));

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('no-store');
    expect(parseBody(res)).toEqual(view);

    // Verify: userId lấy từ token, không từ input của khách
    expect(cases.getCart).toHaveBeenCalledWith({ userId: USER });
  });

  it('anyRoute_returns401_whenTokenHasNoSub', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(apiEvent({ routeKey: GET_CART }));

    // Assert
    expect(res.statusCode).toBe(401);
    expect(cases.getCart).not.toHaveBeenCalled();
  });

  it('addItem_passesUserAndBody_whenValid', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);
    const event = apiEvent({
      routeKey: ADD_ITEM,
      userId: USER,
      body: { productId: PRODUCT_ID, quantity: 2 },
    });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(cases.addCartItem).toHaveBeenCalledWith({
      userId: USER,
      productId: PRODUCT_ID,
      quantity: 2,
    });
  });

  it.each([
    { name: 'addItem_returns400_whenQuantityZero', body: { productId: PRODUCT_ID, quantity: 0 } },
    {
      name: 'addItem_returns400_whenQuantityAbove99',
      body: { productId: PRODUCT_ID, quantity: 100 },
    },
    {
      name: 'addItem_returns400_whenQuantityNotInteger',
      body: { productId: PRODUCT_ID, quantity: 1.5 },
    },
    {
      name: 'addItem_returns400_whenQuantityIsString',
      body: { productId: PRODUCT_ID, quantity: '2' },
    },
    { name: 'addItem_returns400_whenProductIdMissing', body: { quantity: 1 } },
    { name: 'addItem_returns400_whenProductIdHasSlash', body: { productId: 'a/b', quantity: 1 } },
  ])('$name', async ({ body }) => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(apiEvent({ routeKey: ADD_ITEM, userId: USER, body }));

    // Assert
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toMatchObject({ status: 400, errors: expect.any(Array) });
    expect(cases.addCartItem).not.toHaveBeenCalled();
  });

  it('addItem_returns400_whenBodyIsNotJson', async () => {
    // Arrange
    const handler = makeHandler(useCases());
    const event = { ...apiEvent({ routeKey: ADD_ITEM, userId: USER }), body: '{oops' };

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(400);
  });

  it.each([
    {
      name: 'addItem_returns409QuantityLimitWithMaxAddable',
      error: new QuantityLimitError(2),
      status: 409,
      body: { code: 'QUANTITY_LIMIT', maxAddable: 2 },
    },
    {
      name: 'addItem_returns409ProductUnavailable',
      error: new ProductUnavailableError(PRODUCT_ID),
      status: 409,
      body: { code: 'PRODUCT_UNAVAILABLE' },
    },
    {
      name: 'addItem_returns409CartFull',
      error: new CartFullError(),
      status: 409,
      body: { code: 'CART_FULL' },
    },
    {
      name: 'addItem_returns404_whenProductNotFound',
      error: new ProductNotFoundError(PRODUCT_ID),
      status: 404,
      body: { title: 'Not Found' },
    },
  ])('$name', async ({ error, status, body }) => {
    // Arrange
    const handler = makeHandler(useCases({ addCartItem: vi.fn().mockRejectedValue(error) }));
    const event = apiEvent({
      routeKey: ADD_ITEM,
      userId: USER,
      body: { productId: PRODUCT_ID, quantity: 5 },
    });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(status);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    expect(parseBody(res)).toMatchObject({ status, traceId: 'req-test', ...body });
  });

  it('updateItem_passesPathAndQuantity', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);
    const event = apiEvent({
      routeKey: UPDATE_ITEM,
      userId: USER,
      pathParameters: { productId: PRODUCT_ID },
      body: { quantity: 5 },
    });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(cases.updateCartItem).toHaveBeenCalledWith({
      userId: USER,
      productId: PRODUCT_ID,
      quantity: 5,
    });
  });

  it('removeItem_returns404_whenItemNotInCart', async () => {
    // Arrange
    const handler = makeHandler(
      useCases({
        removeCartItem: vi.fn().mockRejectedValue(new CartItemNotFoundError(PRODUCT_ID)),
      }),
    );
    const event = apiEvent({
      routeKey: REMOVE_ITEM,
      userId: USER,
      pathParameters: { productId: PRODUCT_ID },
    });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(404);
  });

  it('anyRoute_returns500WithoutDetail_whenUnexpectedError', async () => {
    // Arrange
    const handler = makeHandler(
      useCases({ getCart: vi.fn().mockRejectedValue(new Error('DynamoDB timeout')) }),
    );

    // Act
    const res = await handler(apiEvent({ routeKey: GET_CART, userId: USER }));

    // Assert
    expect(res.statusCode).toBe(500);
    expect(parseBody(res)).not.toHaveProperty('detail');
  });

  it('merge_passesUserKeyItemsAndContext_andReturnsResult', async () => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);
    const items = [{ productId: PRODUCT_ID, quantity: 2 }];
    const event = apiEvent({
      routeKey: MERGE,
      userId: USER,
      headers: { 'idempotency-key': IDEMPOTENCY_HEADER },
      body: { items },
    });
    const context = { functionName: 'cart' } as never;

    // Act
    const res = await handler(event, context);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('no-store');
    expect(parseBody(res)).toEqual({ cart: view, mergedExisting: [], adjustments: [] });
    expect(cases.mergeCart).toHaveBeenCalledWith(
      { userId: USER, idempotencyKey: IDEMPOTENCY_HEADER, items },
      context,
    );
  });

  it.each([
    { name: 'merge_returns400_whenIdempotencyKeyMissing', headers: {} as Record<string, string> },
    { name: 'merge_returns400_whenIdempotencyKeyNotUuid', headers: { 'idempotency-key': 'abc' } },
  ])('$name', async ({ headers }) => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(
      apiEvent({
        routeKey: MERGE,
        userId: USER,
        headers,
        body: { items: [{ productId: PRODUCT_ID, quantity: 1 }] },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(400);
    expect(cases.mergeCart).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'merge_returns400_whenItemsEmpty', items: [] },
    {
      name: 'merge_returns400_whenOver50Items',
      items: Array.from({ length: 51 }, (_, i) => ({ productId: `p-${i}`, quantity: 1 })),
    },
    {
      name: 'merge_returns400_whenProductIdDuplicated',
      items: [
        { productId: PRODUCT_ID, quantity: 1 },
        { productId: PRODUCT_ID, quantity: 2 },
      ],
    },
    {
      name: 'merge_returns400_whenQuantityOutOfRange',
      items: [{ productId: PRODUCT_ID, quantity: 100 }],
    },
  ])('$name', async ({ items }) => {
    // Arrange
    const cases = useCases();
    const handler = makeHandler(cases);

    // Act
    const res = await handler(
      apiEvent({
        routeKey: MERGE,
        userId: USER,
        headers: { 'idempotency-key': IDEMPOTENCY_HEADER },
        body: { items },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(400);
    expect(cases.mergeCart).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'merge_returns422_whenKeyReusedWithDifferentItems',
      error: new UnprocessableError('Idempotency-Key đã dùng cho nội dung khác', {
        code: 'IDEMPOTENCY_KEY_REUSED',
      }),
      status: 422,
      code: 'IDEMPOTENCY_KEY_REUSED',
    },
    {
      name: 'merge_returns409_whenPreviousMergeStillRunning',
      error: new ConflictError('Lần gửi trước chưa xong', { code: 'MERGE_IN_PROGRESS' }),
      status: 409,
      code: 'MERGE_IN_PROGRESS',
    },
  ])('$name', async ({ error, status, code }) => {
    // Arrange
    const handler = makeHandler(useCases({ mergeCart: vi.fn().mockRejectedValue(error) }));

    // Act
    const res = await handler(
      apiEvent({
        routeKey: MERGE,
        userId: USER,
        headers: { 'idempotency-key': IDEMPOTENCY_HEADER },
        body: { items: [{ productId: PRODUCT_ID, quantity: 1 }] },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(status);
    expect(parseBody(res)).toMatchObject({ status, code });
  });
});
