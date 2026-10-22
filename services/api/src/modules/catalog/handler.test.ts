import { describe, expect, it, vi } from 'vitest';
import { sampleProduct } from '../../../test/helpers/catalog.js';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import { ProductNotFoundError } from './domain/errors.js';
import { InvalidCursorError } from './domain/errors.js';
import { makeHandler } from './handler.js';
import type { CatalogUseCases } from './routes.js';

const GET_PRODUCT = 'GET /api/v1/products/{productId}';
const LIST_PRODUCTS = 'GET /api/v1/products';

/** Mọi use case là mock; test nào cần thì ghi đè use case của mình */
function useCases(overrides: Partial<CatalogUseCases> = {}): CatalogUseCases {
  return { getProduct: vi.fn(), listProducts: vi.fn(), ...overrides };
}
const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';

describe('catalog handler', () => {
  it('getProduct_returns200WithProduct_whenProductExists', async () => {
    // Arrange
    const getProduct = vi.fn().mockResolvedValue(sampleProduct());
    const handler = makeHandler(useCases({ getProduct }));
    const event = apiEvent({ routeKey: GET_PRODUCT, pathParameters: { productId: PRODUCT_ID } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['content-type']).toBe('application/json');
    expect(parseBody(res)).toEqual({
      productId: PRODUCT_ID,
      name: 'ASUS TUF Gaming GeForce RTX 4070 12GB',
      category: 'gpu',
      brand: 'ASUS',
      price: 15_990_000,
      stock: 3,
      status: 'ACTIVE',
      description: 'Card đồ hoạ RTX 4070 12GB GDDR6X, chơi game 1440p.',
      imageUrl: 'https://placehold.co/400x300?text=RTX+4070',
      specs: { vram: '12GB GDDR6X', tdp: '200W' },
      createdAt: '2026-10-01T07:00:00.000Z',
      updatedAt: '2026-10-04T07:00:00.000Z',
    });

    // Verify
    expect(getProduct).toHaveBeenCalledTimes(1);
    expect(getProduct).toHaveBeenCalledWith({ productId: PRODUCT_ID });
  });

  it('getProduct_returns404Problem_whenProductMissing', async () => {
    // Arrange
    const getProduct = vi.fn().mockRejectedValue(new ProductNotFoundError(PRODUCT_ID));
    const handler = makeHandler(useCases({ getProduct }));
    const event = apiEvent({ routeKey: GET_PRODUCT, pathParameters: { productId: PRODUCT_ID } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(404);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    expect(parseBody(res)).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `Không tìm thấy sản phẩm ${PRODUCT_ID}`,
      traceId: 'req-test',
    });

    // Verify
    expect(getProduct).toHaveBeenCalledTimes(1);
  });

  it('getProduct_returns400WithFieldError_whenProductIdHasInvalidCharacters', async () => {
    // Arrange
    const getProduct = vi.fn();
    const handler = makeHandler(useCases({ getProduct }));
    const event = apiEvent({
      routeKey: GET_PRODUCT,
      pathParameters: { productId: 'gpu rtx<4070>' },
    });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toMatchObject({ status: 400, errors: [{ field: 'productId' }] });

    // Verify
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('getProduct_returns500WithoutLeakingMessage_whenUseCaseFailsUnexpectedly', async () => {
    // Arrange
    const getProduct = vi
      .fn()
      .mockRejectedValue(new Error('ResourceNotFoundException: Requested resource not found'));
    const handler = makeHandler(useCases({ getProduct }));
    const event = apiEvent({ routeKey: GET_PRODUCT, pathParameters: { productId: PRODUCT_ID } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(500);
    expect(parseBody(res)).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      traceId: 'req-test',
    });

    // Verify
    expect(getProduct).toHaveBeenCalledTimes(1);
  });

  it('handler_returns404Problem_whenRouteIsUnknown', async () => {
    // Arrange
    const getProduct = vi.fn();
    const handler = makeHandler(useCases({ getProduct }));
    const event = apiEvent({
      routeKey: 'DELETE /api/v1/products/{productId}',
      pathParameters: { productId: PRODUCT_ID },
    });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(404);
    expect(parseBody(res)).toMatchObject({ status: 404, title: 'Not Found' });

    // Verify
    expect(getProduct).not.toHaveBeenCalled();
  });
});

describe('catalog handler: GET /api/v1/products', () => {
  it('listProducts_returns200WithPage_andPassesParsedQuery', async () => {
    // Arrange
    const page = {
      items: [{ productId: PRODUCT_ID, name: 'RTX 4070', category: 'gpu' }],
      nextCursor: 'abc',
    };
    const listProducts = vi.fn().mockResolvedValue(page);
    const handler = makeHandler(useCases({ listProducts }));
    const event = apiEvent({
      routeKey: LIST_PRODUCTS,
      query: { q: '  rtx ', category: 'gpu', sort: 'price_asc', limit: '10', cursor: 'xyz' },
    });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual(page);

    // Verify: q đã bỏ khoảng trắng hai đầu, limit đã thành số
    expect(listProducts).toHaveBeenCalledTimes(1);
    expect(listProducts).toHaveBeenCalledWith({
      q: 'rtx',
      category: 'gpu',
      sort: 'price_asc',
      limit: 10,
      cursor: 'xyz',
    });
  });

  it('listProducts_passesEmptyInput_whenNoQueryString', async () => {
    // Arrange
    const listProducts = vi.fn().mockResolvedValue({ items: [] });
    const handler = makeHandler(useCases({ listProducts }));

    // Act
    const res = await handler(apiEvent({ routeKey: LIST_PRODUCTS }));

    // Assert
    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual({ items: [] });

    // Verify
    expect(listProducts).toHaveBeenCalledWith({});
  });

  it.each<{ name: string; query: Record<string, string>; field: string }>([
    { name: 'listProducts_returns400_whenQueryTooLong', query: { q: 'a'.repeat(31) }, field: 'q' },
    { name: 'listProducts_returns400_whenQueryOnlySpaces', query: { q: '   ' }, field: 'q' },
    {
      name: 'listProducts_returns400_whenCategoryUnknown',
      query: { category: 'peripheral' },
      field: 'category',
    },
    { name: 'listProducts_returns400_whenSortUnknown', query: { sort: 'popular' }, field: 'sort' },
    { name: 'listProducts_returns400_whenLimitZero', query: { limit: '0' }, field: 'limit' },
    { name: 'listProducts_returns400_whenLimitAbove50', query: { limit: '51' }, field: 'limit' },
    { name: 'listProducts_returns400_whenLimitNotNumber', query: { limit: 'abc' }, field: 'limit' },
  ])('$name', async ({ query, field }) => {
    // Arrange
    const listProducts = vi.fn();
    const handler = makeHandler(useCases({ listProducts }));

    // Act
    const res = await handler(apiEvent({ routeKey: LIST_PRODUCTS, query }));

    // Assert
    expect(res.statusCode).toBe(400);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    expect(parseBody(res)).toMatchObject({ status: 400, errors: [{ field }] });

    // Verify
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('listProducts_returns400Problem_whenCursorInvalid', async () => {
    // Arrange
    const listProducts = vi.fn().mockRejectedValue(new InvalidCursorError());
    const handler = makeHandler(useCases({ listProducts }));

    // Act
    const res = await handler(apiEvent({ routeKey: LIST_PRODUCTS, query: { cursor: 'abc' } }));

    // Assert
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Con trỏ phân trang không hợp lệ',
      traceId: 'req-test',
    });

    // Verify
    expect(listProducts).toHaveBeenCalledTimes(1);
  });
});
