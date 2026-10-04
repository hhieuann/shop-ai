import { describe, expect, it, vi } from 'vitest';
import { sampleProduct } from '../../../test/helpers/catalog.js';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import { ProductNotFoundError } from './domain/errors.js';
import { makeHandler } from './handler.js';

const GET_PRODUCT = 'GET /api/v1/products/{productId}';
const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';

describe('catalog handler', () => {
  it('getProduct_returns200WithProduct_whenProductExists', async () => {
    // Arrange
    const getProduct = vi.fn().mockResolvedValue(sampleProduct());
    const handler = makeHandler({ getProduct });
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
    const handler = makeHandler({ getProduct });
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
    const handler = makeHandler({ getProduct });
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
    const handler = makeHandler({ getProduct });
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
    const handler = makeHandler({ getProduct });
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
