import { describe, expect, it, vi } from 'vitest';
import { sampleProduct } from '../../../test/helpers/catalog.js';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import type { HttpResult } from '../../shared/http/response.js';
import { makeAdminProductHandler, type AdminProductUseCases } from './adminHandler.js';
import {
  InvalidSpecKeysError,
  ProductChangedError,
  ProductNotFoundError,
  StockChangedError,
} from './domain/errors.js';

// Route ghi của API admin sản phẩm (#545 thêm, sửa; #554 xoá mềm, khôi phục; catalog.md BR-11 … BR-14). Route đọc: adminHandler.test.ts

const CREATE = 'POST /api/v1/admin/products';
const UPDATE = 'PATCH /api/v1/admin/products/{productId}';
const DELETE = 'DELETE /api/v1/admin/products/{productId}';
const RESTORE = 'POST /api/v1/admin/products/{productId}/restore';
const ADMIN = 'admin-sub-1';
const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';
const ADMIN_CLAIMS = { 'cognito:groups': '[admin]' };
const SEEN = '2026-10-04T07:00:00.000Z';
const PRODUCT = sampleProduct({ productId: PRODUCT_ID });

const DRAFT = {
  name: 'Card MSI RTX 4060',
  category: 'gpu',
  brand: 'MSI',
  price: 8_290_000,
  stock: 5,
  status: 'ACTIVE',
  description: 'Card tầm trung cho 1080p.',
  specs: { vram: '8GB GDDR6' },
};

function useCases() {
  return {
    listAdminProducts: vi.fn(),
    getAdminProduct: vi.fn(),
    createAdminProduct: vi.fn().mockResolvedValue(PRODUCT),
    updateAdminProduct: vi.fn().mockResolvedValue(PRODUCT),
    deleteAdminProduct: vi.fn().mockResolvedValue(undefined),
    restoreAdminProduct: vi.fn().mockResolvedValue({ ...PRODUCT, status: 'INACTIVE' }),
  } satisfies AdminProductUseCases;
}

function writeEvent(
  routeKey: string,
  body?: unknown,
  claims: Record<string, string> = ADMIN_CLAIMS,
) {
  return apiEvent({
    routeKey,
    userId: ADMIN,
    claims,
    pathParameters: { productId: PRODUCT_ID },
    ...(body !== undefined && { body }),
  });
}

describe('admin product handler · ghi · phân quyền', () => {
  it.each([CREATE, UPDATE, DELETE, RESTORE])(
    '%s_returns403_andWritesNothing_forCustomer',
    async (routeKey) => {
      // Arrange
      const uc = useCases();

      // Act
      const res = await makeAdminProductHandler(uc)(
        writeEvent(routeKey, { updatedAt: SEEN, price: 1 }, { 'cognito:groups': '[customer]' }),
      );

      // Assert
      expect(res.statusCode).toBe(403);
      // Verify
      expect(uc.createAdminProduct).not.toHaveBeenCalled();
      expect(uc.updateAdminProduct).not.toHaveBeenCalled();
      expect(uc.deleteAdminProduct).not.toHaveBeenCalled();
      expect(uc.restoreAdminProduct).not.toHaveBeenCalled();
    },
  );
});

describe('admin product handler · POST /api/v1/admin/products', () => {
  it('create_returns201NoStoreWithLocation_andPassesTrimmedDraft', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(
      writeEvent(CREATE, {
        ...DRAFT,
        name: '  Card MSI RTX 4060  ',
        specs: { vram: ' 8GB GDDR6 ' },
      }),
    );

    // Assert
    expect(res.statusCode).toBe(201);
    expect(res.headers).toMatchObject({
      'cache-control': 'no-store',
      location: `/api/v1/admin/products/${PRODUCT_ID}`,
    });
    expect(parseBody(res)).toEqual(PRODUCT);
    // Verify: chuỗi đã bỏ khoảng trắng hai đầu
    expect(uc.createAdminProduct).toHaveBeenCalledWith({ adminId: ADMIN, draft: DRAFT });
  });

  it.each<[string, unknown]>([
    ['thiếu tên', { ...DRAFT, name: undefined }],
    ['tên chỉ có khoảng trắng', { ...DRAFT, name: '   ' }],
    ['tên quá 150 ký tự', { ...DRAFT, name: 'a'.repeat(151) }],
    ['hãng quá 50 ký tự', { ...DRAFT, brand: 'a'.repeat(51) }],
    ['giá 0', { ...DRAFT, price: 0 }],
    ['giá quá 1 tỷ', { ...DRAFT, price: 1_000_000_001 }],
    ['giá lẻ', { ...DRAFT, price: 1.5 }],
    ['tồn kho âm', { ...DRAFT, stock: -1 }],
    ['tồn kho quá 9999', { ...DRAFT, stock: 10_000 }],
    ['mô tả quá 1000 ký tự', { ...DRAFT, description: 'a'.repeat(1001) }],
    ['loại lạ', { ...DRAFT, category: 'tablet' }],
    ['trạng thái lạ', { ...DRAFT, status: 'DELETED' }],
    ['ảnh http', { ...DRAFT, imageUrl: 'http://example.com/a.png' }],
    ['ảnh quá 500 ký tự', { ...DRAFT, imageUrl: `https://example.com/${'a'.repeat(490)}` }],
    ['khoá thông số sai dạng', { ...DRAFT, specs: { 'VRAM GB': '8' } }],
    ['giá trị thông số rỗng', { ...DRAFT, specs: { vram: '  ' } }],
    [
      'quá 20 thông số',
      { ...DRAFT, specs: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 'x'])) },
    ],
    ['trường thừa', { ...DRAFT, productId: PRODUCT_ID }],
  ])('create_returns400WithErrors_when_%s', async (_name, body) => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(writeEvent(CREATE, body));

    // Assert
    expect(res.statusCode).toBe(400);
    expect((parseBody(res) as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
    // Verify
    expect(uc.createAdminProduct).not.toHaveBeenCalled();
  });

  it('create_returns400_whenBodyIsNotJson', async () => {
    // Arrange
    const uc = useCases();
    const event = { ...writeEvent(CREATE, DRAFT), body: '{không phải json' };

    // Act
    const res = await makeAdminProductHandler(uc)(event);

    // Assert
    expect(res.statusCode).toBe(400);
    // Verify
    expect(uc.createAdminProduct).not.toHaveBeenCalled();
  });

  it('create_returns400WithFieldErrors_whenSpecKeyOfOtherCategory', async () => {
    // Arrange
    const uc = useCases();
    uc.createAdminProduct.mockRejectedValue(new InvalidSpecKeysError(['dpi']));

    // Act
    const res = await makeAdminProductHandler(uc)(writeEvent(CREATE, DRAFT));

    // Assert
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toMatchObject({
      errors: [{ field: 'specs.dpi', message: 'Khoá không thuộc loại hàng' }],
    });
  });
});

describe('admin product handler · PATCH /api/v1/admin/products/{productId}', () => {
  it('update_returns200NoStore_andSplitsUpdatedAtExpectedStockFromPatch', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(
      writeEvent(UPDATE, { updatedAt: SEEN, stock: 20, expectedStock: 12, imageUrl: null }),
    );

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
    // Verify
    expect(uc.updateAdminProduct).toHaveBeenCalledWith({
      adminId: ADMIN,
      productId: PRODUCT_ID,
      patch: { stock: 20, imageUrl: null },
      updatedAt: SEEN,
      expectedStock: 12,
    });
  });

  it.each<[string, unknown]>([
    ['thiếu updatedAt', { price: 1 }],
    ['updatedAt sai dạng', { updatedAt: 'hôm qua', price: 1 }],
    ['chỉ có updatedAt', { updatedAt: SEEN }],
    ['chỉ có updatedAt và expectedStock', { updatedAt: SEEN, expectedStock: 1 }],
    ['có stock thiếu expectedStock', { updatedAt: SEEN, stock: 20 }],
    ['đổi loại', { updatedAt: SEEN, category: 'mouse' }],
    ['giá 0', { updatedAt: SEEN, price: 0 }],
    ['expectedStock quá 9999', { updatedAt: SEEN, stock: 1, expectedStock: 10_000 }],
  ])('update_returns400_when_%s', async (_name, body) => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(writeEvent(UPDATE, body));

    // Assert
    expect(res.statusCode).toBe(400);
    // Verify
    expect(uc.updateAdminProduct).not.toHaveBeenCalled();
  });

  it('update_returns409ProductChangedWithCurrent', async () => {
    // Arrange
    const uc = useCases();
    const newer = { ...PRODUCT, price: 1, updatedAt: '2026-11-25T08:00:00.000Z' };
    uc.updateAdminProduct.mockRejectedValue(new ProductChangedError(newer));

    // Act
    const res = await makeAdminProductHandler(uc)(
      writeEvent(UPDATE, { updatedAt: SEEN, price: 2 }),
    );

    // Assert
    expect(res.statusCode).toBe(409);
    expect(parseBody(res)).toMatchObject({ status: 409, code: 'PRODUCT_CHANGED', current: newer });
  });

  it('update_returns409StockChangedWithCurrentStock', async () => {
    // Arrange
    const uc = useCases();
    uc.updateAdminProduct.mockRejectedValue(new StockChangedError(10));

    // Act
    const res = await makeAdminProductHandler(uc)(
      writeEvent(UPDATE, { updatedAt: SEEN, stock: 20, expectedStock: 12 }),
    );

    // Assert
    expect(res.statusCode).toBe(409);
    expect(parseBody(res)).toMatchObject({ code: 'STOCK_CHANGED', currentStock: 10 });
  });

  it('update_returns404_whenDeletedOrMissing', async () => {
    // Arrange
    const uc = useCases();
    uc.updateAdminProduct.mockRejectedValue(new ProductNotFoundError(PRODUCT_ID));

    // Act
    const res = await makeAdminProductHandler(uc)(
      writeEvent(UPDATE, { updatedAt: SEEN, price: 2 }),
    );

    // Assert
    expect(res.statusCode).toBe(404);
  });
});

describe('admin product handler · DELETE, restore (BR-14)', () => {
  it('delete_returns204NoStoreWithoutBody', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(writeEvent(DELETE));

    // Assert
    expect(res.statusCode).toBe(204);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(res.body).toBeUndefined();
    // Verify
    expect(uc.deleteAdminProduct).toHaveBeenCalledWith({ adminId: ADMIN, productId: PRODUCT_ID });
  });

  it('delete_returns404_whenAlreadyDeleted', async () => {
    // Arrange
    const uc = useCases();
    uc.deleteAdminProduct.mockRejectedValue(new ProductNotFoundError(PRODUCT_ID));

    // Act
    const res = await makeAdminProductHandler(uc)(writeEvent(DELETE));

    // Assert
    expect(res.statusCode).toBe(404);
  });

  it('restore_returns200NoStore_withHiddenProduct', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(writeEvent(RESTORE));

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(parseBody(res)).toMatchObject({ status: 'INACTIVE' });
    // Verify
    expect(uc.restoreAdminProduct).toHaveBeenCalledWith({ adminId: ADMIN, productId: PRODUCT_ID });
  });

  it('restore_returns404_whenNotDeleted', async () => {
    // Arrange
    const uc = useCases();
    uc.restoreAdminProduct.mockRejectedValue(new ProductNotFoundError(PRODUCT_ID));

    // Act
    const res = await makeAdminProductHandler(uc)(writeEvent(RESTORE));

    // Assert
    expect(res.statusCode).toBe(404);
  });

  it.each([DELETE, RESTORE, UPDATE])('%s_returns400_whenProductIdMalformed', async (routeKey) => {
    // Arrange
    const uc = useCases();
    const event = apiEvent({
      routeKey,
      userId: ADMIN,
      claims: ADMIN_CLAIMS,
      pathParameters: { productId: 'không hợp lệ' },
      body: { updatedAt: SEEN, price: 1 },
    });

    // Act
    const res = await makeAdminProductHandler(uc)(event);

    // Assert
    expect(res.statusCode).toBe(400);
  });
});

describe('admin product handler · mọi phản hồi đều no-store (catalog.md BR-09)', () => {
  const failing = (error: unknown) => {
    const uc = useCases();
    uc.updateAdminProduct.mockRejectedValue(error);
    return uc;
  };
  it.each<[string, () => Promise<HttpResult>, number]>([
    [
      '400 body sai',
      () => makeAdminProductHandler(useCases())(writeEvent(UPDATE, { updatedAt: SEEN, price: -1 })),
      400,
    ],
    [
      '401 thiếu sub',
      () =>
        makeAdminProductHandler(useCases())(
          apiEvent({
            routeKey: UPDATE,
            claims: ADMIN_CLAIMS,
            pathParameters: { productId: PRODUCT_ID },
          }),
        ),
      401,
    ],
    [
      '403 khách thường',
      () => makeAdminProductHandler(useCases())(writeEvent(UPDATE, { updatedAt: SEEN }, {})),
      403,
    ],
    [
      '404 không thấy',
      () =>
        makeAdminProductHandler(failing(new ProductNotFoundError(PRODUCT_ID)))(
          writeEvent(UPDATE, { updatedAt: SEEN, price: 2 }),
        ),
      404,
    ],
    [
      '409 tồn kho đổi',
      () =>
        makeAdminProductHandler(failing(new StockChangedError(10)))(
          writeEvent(UPDATE, { updatedAt: SEEN, stock: 20, expectedStock: 12 }),
        ),
      409,
    ],
    [
      '500 lỗi lạ',
      () =>
        makeAdminProductHandler(failing(new Error('boom')))(
          writeEvent(UPDATE, { updatedAt: SEEN, price: 2 }),
        ),
      500,
    ],
  ])('returnsNoStore_for_%s', async (_name, call, status) => {
    // Act
    const res = await call();

    // Assert
    expect(res.statusCode).toBe(status);
    expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
  });
});
