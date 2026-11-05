import { describe, expect, it, vi } from 'vitest';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import { makeHandler } from './handler.js';
import type { EventUseCases } from './routes.js';

const RECORD = 'POST /api/v1/events';
const USER = 'user-sub-1';
const PRODUCT_ID = '01M1109DC0MD6M1GX6QXV3KRTS';

function useCases(overrides: Partial<EventUseCases> = {}): EventUseCases {
  return { recordEvent: vi.fn().mockResolvedValue(undefined), ...overrides };
}

describe('events handler', () => {
  it.each(['VIEW', 'ADD_TO_CART'])('record_returns202NoBody_when%s', async (eventType) => {
    // Arrange
    const cases = useCases();

    // Act
    const res = await makeHandler(cases)(
      apiEvent({ routeKey: RECORD, userId: USER, body: { productId: PRODUCT_ID, eventType } }),
    );

    // Assert: userId lấy từ token, không từ body
    expect(res.statusCode).toBe(202);
    expect(res.body).toBeUndefined();
    expect(cases.recordEvent).toHaveBeenCalledWith({
      userId: USER,
      productId: PRODUCT_ID,
      eventType,
    });
  });

  it.each([
    ['PURCHASE từ client', { productId: PRODUCT_ID, eventType: 'PURCHASE' }],
    ['userId trong body', { productId: PRODUCT_ID, eventType: 'VIEW', userId: 'someone-else' }],
    ['timestamp trong body', { productId: PRODUCT_ID, eventType: 'VIEW', timestamp: '2020-01-01' }],
    ['thiếu productId', { eventType: 'VIEW' }],
    ['productId có ký tự lạ', { productId: '<script>', eventType: 'VIEW' }],
    ['body không phải JSON', undefined],
  ])('record_returns400AndDoesNotRecord_when %s', async (_name, body) => {
    // Arrange
    const cases = useCases();
    const event = apiEvent({ routeKey: RECORD, userId: USER, body });
    if (body === undefined) event.body = '{không phải json';

    // Act
    const res = await makeHandler(cases)(event);

    // Assert
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toMatchObject({ status: 400, traceId: 'req-test' });
    expect(cases.recordEvent).not.toHaveBeenCalled();
  });

  it('record_returns401_whenTokenHasNoSub', async () => {
    // Arrange
    const cases = useCases();

    // Act
    const res = await makeHandler(cases)(
      apiEvent({ routeKey: RECORD, body: { productId: PRODUCT_ID, eventType: 'VIEW' } }),
    );

    // Assert
    expect(res.statusCode).toBe(401);
    expect(cases.recordEvent).not.toHaveBeenCalled();
  });

  it('record_returns500WithoutDetail_whenWriteFails', async () => {
    // Arrange
    const cases = useCases({ recordEvent: vi.fn().mockRejectedValue(new Error('DynamoDB lỗi')) });

    // Act
    const res = await makeHandler(cases)(
      apiEvent({
        routeKey: RECORD,
        userId: USER,
        body: { productId: PRODUCT_ID, eventType: 'VIEW' },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('DynamoDB lỗi');
  });
});
