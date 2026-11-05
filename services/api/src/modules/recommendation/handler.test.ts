import { describe, expect, it, vi } from 'vitest';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import type { RecsResult } from './domain/recs.js';
import { makeHandler } from './handler.js';
import type { RecsUseCases } from './routes.js';

const ALSO_BOUGHT = 'GET /api/v1/recs/also-bought';
const FOR_YOU = 'GET /api/v1/recs/for-you';
const BESTSELLERS = 'GET /api/v1/recs/bestsellers';

const RESULT: RecsResult = {
  source: 'ALSO_BOUGHT',
  items: [
    {
      productId: 'psu-1',
      name: 'Nguồn 750W',
      category: 'psu',
      brand: 'Corsair',
      price: 2_500_000,
      stock: 4,
      status: 'ACTIVE',
    },
  ],
};

/** Mọi use case là mock trả RESULT; test nào cần thì ghi đè use case của mình */
function useCases(overrides: Partial<RecsUseCases> = {}): RecsUseCases {
  return {
    getAlsoBought: vi.fn().mockResolvedValue(RESULT),
    getForYou: vi.fn().mockResolvedValue(RESULT),
    getBestsellers: vi.fn().mockResolvedValue(RESULT),
    ...overrides,
  };
}

describe('recommendation handler', () => {
  it('alsoBought_returns200_withDefaultLimitAndEmptyExclude', async () => {
    // Arrange
    const getAlsoBought = vi.fn().mockResolvedValue(RESULT);
    const handler = makeHandler(useCases({ getAlsoBought }));
    const event = apiEvent({ routeKey: ALSO_BOUGHT, query: { productId: 'gpu-1' } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual(RESULT);

    // Verify: RecsLimit mặc định 6
    expect(getAlsoBought).toHaveBeenCalledWith({ productId: 'gpu-1', exclude: [], limit: 6 });
  });

  it('alsoBought_splitsCommaSeparatedExclude', async () => {
    // Arrange
    const getAlsoBought = vi.fn().mockResolvedValue(RESULT);
    const handler = makeHandler(useCases({ getAlsoBought }));
    const event = apiEvent({
      routeKey: ALSO_BOUGHT,
      query: { productId: 'gpu-1', exclude: 'a,b', limit: '3' },
    });

    // Act
    await handler(event);

    // Verify: style form, explode false (contracts/openapi.yaml, RecsExclude)
    expect(getAlsoBought).toHaveBeenCalledWith({
      productId: 'gpu-1',
      exclude: ['a', 'b'],
      limit: 3,
    });
  });

  it('alsoBought_returns400_whenProductIdMissing', async () => {
    // Arrange
    const handler = makeHandler(useCases());
    const event = apiEvent({ routeKey: ALSO_BOUGHT });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(400);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
  });

  it.each([
    ['0', 'limit dưới 1'],
    ['11', 'limit trên 10'],
    ['abc', 'limit không phải số'],
  ])('bestsellers_returns400_whenLimitIs%s', async (value) => {
    // Arrange
    const getBestsellers = vi.fn();
    const handler = makeHandler(useCases({ getBestsellers }));
    const event = apiEvent({ routeKey: BESTSELLERS, query: { limit: value } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(400);
    expect(getBestsellers).not.toHaveBeenCalled();
  });

  it('bestsellers_returns400_whenExcludeHasMoreThan20Ids', async () => {
    // Arrange
    const ids = Array.from({ length: 21 }, (_, i) => `p${i}`).join(',');
    const handler = makeHandler(useCases());
    const event = apiEvent({ routeKey: BESTSELLERS, query: { exclude: ids } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(400);
  });

  it('bestsellers_returns400_whenCategoryUnknown', async () => {
    // Arrange
    const handler = makeHandler(useCases());
    const event = apiEvent({ routeKey: BESTSELLERS, query: { category: 'tivi' } });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(400);
  });

  it('bestsellers_passesCategory_onlyWhenGiven', async () => {
    // Arrange
    const getBestsellers = vi.fn().mockResolvedValue(RESULT);
    const handler = makeHandler(useCases({ getBestsellers }));

    // Act
    await handler(apiEvent({ routeKey: BESTSELLERS, query: { category: 'gpu' } }));
    await handler(apiEvent({ routeKey: BESTSELLERS }));

    // Verify
    expect(getBestsellers).toHaveBeenNthCalledWith(1, { category: 'gpu', exclude: [], limit: 6 });
    expect(getBestsellers).toHaveBeenNthCalledWith(2, { exclude: [], limit: 6 });
  });

  it('forYou_usesSubFromToken_andIsNotCached', async () => {
    // Arrange
    const getForYou = vi.fn().mockResolvedValue({ ...RESULT, source: 'PERSONALIZED' });
    const handler = makeHandler(useCases({ getForYou }));
    const event = apiEvent({ routeKey: FOR_YOU, userId: 'user-1' });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('no-store');

    // Verify
    expect(getForYou).toHaveBeenCalledWith({ userId: 'user-1', exclude: [], limit: 6 });
  });

  it('forYou_returns401_whenNoSub', async () => {
    // Arrange
    const getForYou = vi.fn();
    const handler = makeHandler(useCases({ getForYou }));
    const event = apiEvent({ routeKey: FOR_YOU });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(401);
    expect(getForYou).not.toHaveBeenCalled();
  });

  it('returns500WithoutDetails_whenUseCaseThrowsUnexpectedError', async () => {
    // Arrange: vd. DynamoDB lỗi
    const getBestsellers = vi.fn().mockRejectedValue(new Error('DynamoDB timeout'));
    const handler = makeHandler(useCases({ getBestsellers }));
    const event = apiEvent({ routeKey: BESTSELLERS });

    // Act
    const res = await handler(event);

    // Assert
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('DynamoDB timeout');
  });

  it('returns404_whenRouteUnknown', async () => {
    // Arrange
    const handler = makeHandler(useCases());

    // Act
    const res = await handler(apiEvent({ routeKey: 'GET /api/v1/recs/unknown' }));

    // Assert
    expect(res.statusCode).toBe(404);
  });
});
