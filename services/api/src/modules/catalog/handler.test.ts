import { describe, expect, it, vi } from 'vitest';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import type { ProductView } from './application/getProduct.js';
import { ProductNotFoundError } from './domain/errors.js';
import { makeHandler } from './handler.js';

const GET_PRODUCT = 'GET /api/v1/products/{id}';

const rtx4070: ProductView = {
  id: 'gpu-rtx4070',
  name: 'NVIDIA GeForce RTX 4070 12GB',
  category: 'gpu',
  priceVnd: 15_990_000,
  availability: 'IN_STOCK',
  attributes: { vramGb: 12, tdpW: 200 },
};

describe('catalog handler', () => {
  it('getProduct_returns200WithProduct_whenProductExists', async () => {
    // Arrange
    const getProduct = vi.fn().mockResolvedValue(rtx4070);
    const handler = makeHandler({ getProduct });
    const event = apiEvent({ routeKey: GET_PRODUCT, pathParameters: { id: 'gpu-rtx4070' } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['content-type']).toBe('application/json');
    expect(parseBody(res)).toEqual({
      id: 'gpu-rtx4070',
      name: 'NVIDIA GeForce RTX 4070 12GB',
      category: 'gpu',
      priceVnd: 15_990_000,
      availability: 'IN_STOCK',
      attributes: { vramGb: 12, tdpW: 200 },
    });

    // Verify
    expect(getProduct).toHaveBeenCalledTimes(1);
    expect(getProduct).toHaveBeenCalledWith({ id: 'gpu-rtx4070' });
  });

  it('getProduct_returns404Problem_whenProductMissing', async () => {
    // Arrange
    const getProduct = vi.fn().mockRejectedValue(new ProductNotFoundError('khong-co'));
    const handler = makeHandler({ getProduct });
    const event = apiEvent({ routeKey: GET_PRODUCT, pathParameters: { id: 'khong-co' } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(404);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    expect(parseBody(res)).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Không tìm thấy sản phẩm khong-co',
      traceId: 'req-test',
    });

    // Verify
    expect(getProduct).toHaveBeenCalledTimes(1);
  });

  it('getProduct_returns400WithFieldError_whenIdHasInvalidCharacters', async () => {
    // Arrange
    const getProduct = vi.fn();
    const handler = makeHandler({ getProduct });
    const event = apiEvent({ routeKey: GET_PRODUCT, pathParameters: { id: 'gpu rtx<4070>' } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toMatchObject({ status: 400, errors: [{ field: 'id' }] });

    // Verify
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('getProduct_returns500WithoutLeakingMessage_whenUseCaseFailsUnexpectedly', async () => {
    // Arrange
    const getProduct = vi
      .fn()
      .mockRejectedValue(new Error('ResourceNotFoundException: Requested resource not found'));
    const handler = makeHandler({ getProduct });
    const event = apiEvent({ routeKey: GET_PRODUCT, pathParameters: { id: 'gpu-rtx4070' } });

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
      routeKey: 'DELETE /api/v1/products/{id}',
      pathParameters: { id: 'gpu-rtx4070' },
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
