import { describe, expect, it, vi } from 'vitest';
import { apiEvent, parseBody } from '../../../test/helpers/http.js';
import { makeAdminProductHandler, type AdminProductUseCases } from './adminHandler.js';

// Route xin vé tải ảnh sản phẩm (#560, catalog.md BR-16)

const ROUTE = 'POST /api/v1/admin/product-images';
const ADMIN = 'admin-sub-1';
const ADMIN_CLAIMS = { 'cognito:groups': '[admin]' };
const RESULT = {
  upload: { url: 'https://bucket.s3.amazonaws.com/', fields: { key: 'products/X.webp' } },
  imageUrl: 'https://shop.example/images/products/01KAB3Q5G00000000000000001.webp',
  expiresAt: '2026-11-25T09:05:00.000Z',
};

function useCases() {
  return {
    listAdminProducts: vi.fn(),
    getAdminProduct: vi.fn(),
    createAdminProduct: vi.fn(),
    updateAdminProduct: vi.fn(),
    deleteAdminProduct: vi.fn(),
    restoreAdminProduct: vi.fn(),
    createProductImageUpload: vi.fn().mockResolvedValue(RESULT),
  } satisfies AdminProductUseCases;
}

function event(body: unknown, claims: Record<string, string> = ADMIN_CLAIMS, userId = ADMIN) {
  return apiEvent({ routeKey: ROUTE, userId, claims, body });
}

describe('admin product handler · POST /api/v1/admin/product-images (BR-16)', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'returns200NoStore_withUploadAndImageUrl_for_%s',
    async (contentType) => {
      // Arrange
      const uc = useCases();

      // Act
      const res = await makeAdminProductHandler(uc)(event({ contentType, size: 1024 }));

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.headers).toMatchObject({ 'cache-control': 'no-store' });
      expect(parseBody(res)).toEqual(RESULT);
      // Verify: chỉ truyền loại tệp, không nhận tên tệp người dùng
      expect(uc.createProductImageUpload).toHaveBeenCalledWith({ adminId: ADMIN, contentType });
    },
  );

  it('accepts_exactly3MB', async () => {
    // Act
    const res = await makeAdminProductHandler(useCases())(
      event({ contentType: 'image/png', size: 3 * 1024 * 1024 }),
    );

    // Assert
    expect(res.statusCode).toBe(200);
  });

  it.each<[string, unknown]>([
    ['loại SVG', { contentType: 'image/svg+xml', size: 1024 }],
    ['loại GIF', { contentType: 'image/gif', size: 1024 }],
    ['tệp rỗng 0 B', { contentType: 'image/jpeg', size: 0 }],
    ['quá 3 MB một byte', { contentType: 'image/jpeg', size: 3 * 1024 * 1024 + 1 }],
    ['size không phải số', { contentType: 'image/jpeg', size: '1024' }],
    ['thiếu size', { contentType: 'image/jpeg' }],
    ['gửi kèm tên tệp', { contentType: 'image/jpeg', size: 1024, fileName: '../anh.jpg' }],
  ])('returns400_andSignsNothing_when_%s', async (_name, body) => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(event(body));

    // Assert
    expect(res.statusCode).toBe(400);
    expect((parseBody(res) as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
    // Verify
    expect(uc.createProductImageUpload).not.toHaveBeenCalled();
  });

  it('returns400_whenBodyIsNotJson', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)({ ...event({}), body: 'không phải json' });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(uc.createProductImageUpload).not.toHaveBeenCalled();
  });

  it('returns403_forCustomer', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(
      event({ contentType: 'image/jpeg', size: 1024 }, { 'cognito:groups': '[customer]' }),
    );

    // Assert
    expect(res.statusCode).toBe(403);
    expect(parseBody(res)).toMatchObject({ code: 'FORBIDDEN' });
    expect(uc.createProductImageUpload).not.toHaveBeenCalled();
  });

  it('returns401_withoutToken', async () => {
    // Arrange
    const uc = useCases();

    // Act
    const res = await makeAdminProductHandler(uc)(
      event({ contentType: 'image/jpeg', size: 1024 }, ADMIN_CLAIMS, ''),
    );

    // Assert
    expect(res.statusCode).toBe(401);
    expect(uc.createProductImageUpload).not.toHaveBeenCalled();
  });

  it('returns500WithoutDetail_whenUploadNotConfigured', async () => {
    // Arrange: thiếu biến môi trường thì adminLambda truyền hàm ném lỗi thường
    const uc = useCases();
    uc.createProductImageUpload.mockRejectedValue(
      new Error('Tải ảnh chưa bật: thiếu PRODUCT_IMAGES_BUCKET'),
    );

    // Act
    const res = await makeAdminProductHandler(uc)(event({ contentType: 'image/jpeg', size: 1 }));

    // Assert
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(parseBody(res))).not.toContain('PRODUCT_IMAGES_BUCKET');
  });
});

describe('admin product handler · imageUrl luôn là https đầy đủ (BR-11, BR-16)', () => {
  const create = (imageUrl: string) =>
    apiEvent({
      routeKey: 'POST /api/v1/admin/products',
      userId: ADMIN,
      claims: ADMIN_CLAIMS,
      body: {
        name: 'Card MSI RTX 4060',
        category: 'gpu',
        brand: 'MSI',
        price: 8_290_000,
        stock: 5,
        status: 'ACTIVE',
        description: 'Card tầm trung.',
        imageUrl,
      },
    });

  it.each([
    'https://example.com/a.webp',
    'https://shop.example/images/products/01KAB3Q5G00000000000000001.webp',
  ])('create_accepts_imageUrl_%s', async (imageUrl) => {
    // Arrange
    const uc = useCases();
    uc.createAdminProduct.mockResolvedValue({});

    // Act
    const res = await makeAdminProductHandler(uc)(create(imageUrl));

    // Assert
    expect(res.statusCode).toBe(201);
  });

  it.each([
    // Đường dẫn tương đối không hợp format uri của Product.imageUrl, CartItem.imageUrl
    '/images/products/01KAB3Q5G00000000000000001.jpg',
    'http://example.com/a.jpg',
  ])('create_rejects_imageUrl_%s', async (imageUrl) => {
    // Act
    const res = await makeAdminProductHandler(useCases())(create(imageUrl));

    // Assert
    expect(res.statusCode).toBe(400);
  });
});
