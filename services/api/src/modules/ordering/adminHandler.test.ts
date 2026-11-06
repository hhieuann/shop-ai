import { describe, expect, it, vi } from 'vitest';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import { makeAdminHandler, type AdminOrderUseCases } from './adminHandler.js';
import {
  AdminOrderNotFoundError,
  InvalidOrderCursorError,
  InvalidStatusTransitionError,
} from './domain/errors.js';
import type { OrderSummary } from './domain/order.js';

const LIST = 'GET /api/v1/admin/orders';
const UPDATE = 'PATCH /api/v1/admin/orders/{orderId}';
const ADMIN = 'admin-sub-1';
const ORDER_ID = '01K8GQ5Z3XM2T9V4B6N8P0R2S4';
/** Claim nhóm như HTTP API thật gửi tới Lambda: mảng bị đổi thành chuỗi */
const ADMIN_CLAIMS = { 'cognito:groups': '[admin]' };

const SUMMARY: OrderSummary = {
  orderId: ORDER_ID,
  status: 'SHIPPED',
  totalAmount: 15_900_000,
  itemCount: 1,
  createdAt: '2026-10-25T03:00:00.000Z',
};

function useCases() {
  return {
    listAdminOrders: vi.fn().mockResolvedValue({ items: [SUMMARY], nextCursor: 'next' }),
    advanceOrderStatus: vi.fn().mockResolvedValue(SUMMARY),
  } satisfies AdminOrderUseCases;
}

function listEvent(
  overrides: { query?: Record<string, string>; claims?: Record<string, string | string[]> } = {},
) {
  return apiEvent({
    routeKey: LIST,
    userId: ADMIN,
    claims: overrides.claims ?? ADMIN_CLAIMS,
    query: overrides.query ?? { status: 'CONFIRMED' },
  });
}

function updateEvent(
  overrides: { body?: unknown; claims?: Record<string, string | string[]> } = {},
) {
  return apiEvent({
    routeKey: UPDATE,
    userId: ADMIN,
    claims: overrides.claims ?? ADMIN_CLAIMS,
    pathParameters: { orderId: ORDER_ID },
    body: 'body' in overrides ? overrides.body : { status: 'SHIPPED' },
  });
}

describe('admin handler · phân quyền (threat model L6, O3)', () => {
  it.each([LIST, UPDATE])('%s_returns401_whenNoSub', async (routeKey) => {
    // Arrange
    const uc = useCases();
    const event = apiEvent({
      routeKey,
      claims: ADMIN_CLAIMS,
      pathParameters: { orderId: ORDER_ID },
    });

    // Act
    const res = await makeAdminHandler(uc)(event);

    // Assert
    expect(res.statusCode).toBe(401);
    // Verify
    expect(uc.listAdminOrders).not.toHaveBeenCalled();
    expect(uc.advanceOrderStatus).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, string | string[]>]>([
    ['không có claim nhóm', {}],
    ['nhóm khác dạng chuỗi', { 'cognito:groups': '[customer]' }],
    ['nhóm khác dạng mảng', { 'cognito:groups': ['customer'] }],
    ['tên gần giống admin', { 'cognito:groups': '[administrator]' }],
  ])('returns403_andCallsNothing_when_%s', async (_name, claims) => {
    // Arrange
    const uc = useCases();

    // Act
    const list = await makeAdminHandler(uc)(listEvent({ claims }));
    const update = await makeAdminHandler(uc)(updateEvent({ claims }));

    // Assert
    for (const res of [list, update]) {
      expect(res.statusCode).toBe(403);
      expect(res.headers).toMatchObject({ 'content-type': 'application/problem+json' });
      expect(parseBody(res)).toMatchObject({ status: 403, code: 'FORBIDDEN', traceId: 'req-test' });
    }
    // Verify: không đọc, không ghi gì
    expect(uc.listAdminOrders).not.toHaveBeenCalled();
    expect(uc.advanceOrderStatus).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, string | string[]>]>([
    ['chuỗi như HTTP API gửi', { 'cognito:groups': '[admin]' }],
    ['chuỗi nhiều nhóm', { 'cognito:groups': '[customer admin]' }],
    ['mảng', { 'cognito:groups': ['admin'] }],
  ])('allowsAdmin_whenGroupsClaimIs_%s', async (_name, claims) => {
    const uc = useCases();

    const res = await makeAdminHandler(uc)(listEvent({ claims }));

    expect(res.statusCode).toBe(200);
  });
});

describe('admin handler · GET /api/v1/admin/orders', () => {
  it('list_returns200NoStore_andPassesQuery', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminHandler(uc)(
      listEvent({ query: { status: 'SHIPPED', limit: '5', cursor: 'abc' } }),
    );

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(parseBody(res)).toEqual({ items: [SUMMARY], nextCursor: 'next' });
    // Verify
    expect(uc.listAdminOrders).toHaveBeenCalledWith({ status: 'SHIPPED', limit: 5, cursor: 'abc' });
  });

  it.each<[string, Record<string, string>]>([
    ['thiếu status', {}],
    ['status không cho xem', { status: 'PENDING' }],
    ['limit quá lớn', { status: 'CONFIRMED', limit: '51' }],
    ['limit không phải số', { status: 'CONFIRMED', limit: 'abc' }],
  ])('list_returns400_when_%s', async (_name, query) => {
    const uc = useCases();

    const res = await makeAdminHandler(uc)(listEvent({ query }));

    expect(res.statusCode).toBe(400);
    expect(uc.listAdminOrders).not.toHaveBeenCalled();
  });

  it('list_returns400_whenCursorInvalid', async () => {
    const uc = useCases();
    uc.listAdminOrders.mockRejectedValue(new InvalidOrderCursorError());

    const res = await makeAdminHandler(uc)(
      listEvent({ query: { status: 'CONFIRMED', cursor: 'x' } }),
    );

    expect(res.statusCode).toBe(400);
  });
});

describe('admin handler · PATCH /api/v1/admin/orders/{orderId}', () => {
  it('update_returns200Summary_andPassesAdminIdFromToken', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminHandler(uc)(updateEvent());

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(parseBody(res)).toEqual(SUMMARY);
    expect(res.body).not.toMatch(/shippingAddress|userId/);
    // Verify
    expect(uc.advanceOrderStatus).toHaveBeenCalledWith({
      adminId: ADMIN,
      orderId: ORDER_ID,
      to: 'SHIPPED',
    });
  });

  it.each<[string, unknown]>([
    ['không có body', undefined],
    ['trạng thái không cho chuyển tới', { status: 'CANCELLED' }],
    ['trạng thái lùi', { status: 'CONFIRMED' }],
    ['thừa trường', { status: 'SHIPPED', userId: 'user-1' }],
  ])('update_returns400_when_%s', async (_name, body) => {
    const uc = useCases();

    const res = await makeAdminHandler(uc)(updateEvent({ body }));

    expect(res.statusCode).toBe(400);
    expect(uc.advanceOrderStatus).not.toHaveBeenCalled();
  });

  it('update_returns409WithCurrentStatus_whenTransitionInvalid', async () => {
    // Arrange
    const uc = useCases();
    uc.advanceOrderStatus.mockRejectedValue(
      new InvalidStatusTransitionError(ORDER_ID, 'CANCELLED'),
    );

    // Act
    const res = await makeAdminHandler(uc)(updateEvent());

    // Assert
    expect(res.statusCode).toBe(409);
    expect(parseBody(res)).toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
      currentStatus: 'CANCELLED',
    });
  });

  it('update_returns404_whenOrderNotFound', async () => {
    const uc = useCases();
    uc.advanceOrderStatus.mockRejectedValue(new AdminOrderNotFoundError(ORDER_ID));

    const res = await makeAdminHandler(uc)(updateEvent());

    expect(res.statusCode).toBe(404);
    expect(parseBody(res)).toMatchObject({ detail: expect.stringContaining('thử lại sau') });
  });

  it('update_returns500WithoutDetail_whenUnexpectedError', async () => {
    const uc = useCases();
    uc.advanceOrderStatus.mockRejectedValue(new Error('dynamo hỏng'));

    const res = await makeAdminHandler(uc)(updateEvent());

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('dynamo hỏng');
  });
});
