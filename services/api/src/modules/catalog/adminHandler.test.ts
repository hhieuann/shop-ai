import { describe, expect, it, vi } from 'vitest';
import { sampleProduct } from '../../../test/helpers/catalog.js';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import { makeAdminProductHandler, type AdminProductUseCases } from './adminHandler.js';
import { InvalidCursorError, ProductNotFoundError } from './domain/errors.js';

const LIST = 'GET /api/v1/admin/products';
const DETAIL = 'GET /api/v1/admin/products/{productId}';
const ADMIN = 'admin-sub-1';
const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';
/** Claim nhóm như HTTP API thật gửi tới Lambda: mảng bị đổi thành chuỗi */
const ADMIN_CLAIMS = { 'cognito:groups': '[admin]' };
const COUNTS = { active: 7, inactive: 1, deleted: 1 };
const PRODUCT = sampleProduct({ productId: PRODUCT_ID });

function useCases() {
  return {
    listAdminProducts: vi
      .fn()
      .mockResolvedValue({ items: [PRODUCT], nextCursor: 'next', counts: COUNTS }),
    getAdminProduct: vi.fn().mockResolvedValue(PRODUCT),
    createAdminProduct: vi.fn().mockResolvedValue(PRODUCT),
    updateAdminProduct: vi.fn().mockResolvedValue(PRODUCT),
    deleteAdminProduct: vi.fn().mockResolvedValue(undefined),
    restoreAdminProduct: vi.fn().mockResolvedValue({ ...PRODUCT, status: 'INACTIVE' }),
    createProductImageUpload: vi.fn(),
  } satisfies AdminProductUseCases;
}

function listEvent(
  overrides: { query?: Record<string, string>; claims?: Record<string, string | string[]> } = {},
) {
  return apiEvent({
    routeKey: LIST,
    userId: ADMIN,
    claims: overrides.claims ?? ADMIN_CLAIMS,
    query: overrides.query ?? { category: 'gpu' },
  });
}

function detailEvent(
  overrides: { productId?: string; claims?: Record<string, string | string[]> } = {},
) {
  return apiEvent({
    routeKey: DETAIL,
    userId: ADMIN,
    claims: overrides.claims ?? ADMIN_CLAIMS,
    pathParameters: { productId: overrides.productId ?? PRODUCT_ID },
  });
}

describe('admin product handler · phân quyền (catalog.md BR-09)', () => {
  it.each([LIST, DETAIL])('%s_returns401_whenNoSub', async (routeKey) => {
    // Arrange
    const uc = useCases();
    const event = apiEvent({
      routeKey,
      claims: ADMIN_CLAIMS,
      query: { category: 'gpu' },
      pathParameters: { productId: PRODUCT_ID },
    });

    // Act
    const res = await makeAdminProductHandler(uc)(event);

    // Assert
    expect(res.statusCode).toBe(401);
    // Verify
    expect(uc.listAdminProducts).not.toHaveBeenCalled();
    expect(uc.getAdminProduct).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, string | string[]>]>([
    ['không có claim nhóm', {}],
    ['nhóm khác dạng chuỗi', { 'cognito:groups': '[customer]' }],
    ['nhóm khác dạng mảng', { 'cognito:groups': ['customer'] }],
    ['tên gần giống admin', { 'cognito:groups': '[administrator]' }],
  ])('returns403_andReadsNothing_when_%s', async (_name, claims) => {
    // Arrange
    const uc = useCases();

    // Act
    const list = await makeAdminProductHandler(uc)(listEvent({ claims }));
    const detail = await makeAdminProductHandler(uc)(detailEvent({ claims }));

    // Assert
    for (const res of [list, detail]) {
      expect(res.statusCode).toBe(403);
      expect(res.headers).toMatchObject({ 'content-type': 'application/problem+json' });
      expect(parseBody(res)).toMatchObject({ status: 403, code: 'FORBIDDEN', traceId: 'req-test' });
    }
    // Verify
    expect(uc.listAdminProducts).not.toHaveBeenCalled();
    expect(uc.getAdminProduct).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, string | string[]>]>([
    ['chuỗi như HTTP API gửi', { 'cognito:groups': '[admin]' }],
    ['chuỗi nhiều nhóm', { 'cognito:groups': '[customer admin]' }],
    ['mảng', { 'cognito:groups': ['admin'] }],
  ])('allowsAdmin_whenGroupsClaimIs_%s', async (_name, claims) => {
    // Act
    const res = await makeAdminProductHandler(useCases())(listEvent({ claims }));

    // Assert
    expect(res.statusCode).toBe(200);
  });
});

describe('admin product handler · GET /api/v1/admin/products (BR-10)', () => {
  it('list_returns200NoStore_withItemsCursorAndCounts', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(
      listEvent({
        query: { category: 'gpu', status: 'DELETED', q: '  rtx ', limit: '5', cursor: 'abc' },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(parseBody(res)).toEqual({ items: [PRODUCT], nextCursor: 'next', counts: COUNTS });
    // Verify: q bỏ khoảng trắng hai đầu, limit đổi sang số
    expect(uc.listAdminProducts).toHaveBeenCalledWith({
      category: 'gpu',
      status: 'DELETED',
      q: 'rtx',
      limit: 5,
      cursor: 'abc',
    });
  });

  it('list_passesNoStatus_whenStatusMissing', async () => {
    // Arrange
    const uc = useCases();

    // Act
    await makeAdminProductHandler(uc)(listEvent({ query: { category: 'laptop' } }));

    // Assert: use case tự hiểu là đang bán và đã ẩn
    expect(uc.listAdminProducts).toHaveBeenCalledWith({ category: 'laptop' });
  });

  it.each<[string, Record<string, string>]>([
    ['thiếu category', {}],
    ['category lạ', { category: 'tablet' }],
    ['status lạ', { category: 'gpu', status: 'ALL' }],
    ['q rỗng sau khi bỏ khoảng trắng', { category: 'gpu', q: '   ' }],
    ['q quá 30 ký tự', { category: 'gpu', q: 'a'.repeat(31) }],
    ['limit 0', { category: 'gpu', limit: '0' }],
    ['limit quá lớn', { category: 'gpu', limit: '51' }],
    ['limit không phải số', { category: 'gpu', limit: 'abc' }],
    ['cursor quá dài', { category: 'gpu', cursor: 'a'.repeat(201) }],
  ])('list_returns400_when_%s', async (_name, query) => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(listEvent({ query }));

    // Assert
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toMatchObject({ status: 400, traceId: 'req-test' });
    expect((parseBody(res) as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
    // Verify
    expect(uc.listAdminProducts).not.toHaveBeenCalled();
  });

  it('list_returns400_whenUseCaseRejectsCursor', async () => {
    // Arrange
    const uc = useCases();
    uc.listAdminProducts.mockRejectedValue(new InvalidCursorError());

    // Act
    const res = await makeAdminProductHandler(uc)(
      listEvent({ query: { category: 'gpu', cursor: 'sai' } }),
    );

    // Assert
    expect(res.statusCode).toBe(400);
  });
});

describe('admin product handler · GET /api/v1/admin/products/{productId}', () => {
  it('detail_returns200NoStore_withDeletedAt_whenSoftDeleted', async () => {
    // Arrange
    const uc = useCases();
    const deleted = { ...PRODUCT, status: 'INACTIVE', deletedAt: '2026-11-25T08:00:00.000Z' };
    uc.getAdminProduct.mockResolvedValue(deleted);

    // Act
    const res = await makeAdminProductHandler(uc)(detailEvent());

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(parseBody(res)).toEqual(deleted);
    // Verify
    expect(uc.getAdminProduct).toHaveBeenCalledWith({ productId: PRODUCT_ID });
  });

  it('detail_returns404_whenProductMissing', async () => {
    // Arrange
    const uc = useCases();
    uc.getAdminProduct.mockRejectedValue(new ProductNotFoundError(PRODUCT_ID));

    // Act
    const res = await makeAdminProductHandler(uc)(detailEvent());

    // Assert
    expect(res.statusCode).toBe(404);
    expect(res.headers).toMatchObject({ 'content-type': 'application/problem+json' });
  });

  it('detail_returns400_whenProductIdMalformed', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(detailEvent({ productId: 'không hợp lệ' }));

    // Assert
    expect(res.statusCode).toBe(400);
    // Verify
    expect(uc.getAdminProduct).not.toHaveBeenCalled();
  });
});

describe('admin product handler · lỗi khác', () => {
  it('returns404_whenRouteUnknown', async () => {
    // Act
    const res = await makeAdminProductHandler(useCases())(
      apiEvent({
        routeKey: 'PUT /api/v1/admin/products/{productId}',
        userId: ADMIN,
        claims: ADMIN_CLAIMS,
        pathParameters: { productId: PRODUCT_ID },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(404);
  });

  it('returns500WithoutStack_whenUseCaseThrowsUnexpected', async () => {
    // Arrange
    const uc = useCases();
    uc.listAdminProducts.mockRejectedValue(new Error('DynamoDB timeout'));

    // Act
    const res = await makeAdminProductHandler(uc)(listEvent());

    // Assert
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(parseBody(res))).not.toContain('DynamoDB timeout');
  });
});
