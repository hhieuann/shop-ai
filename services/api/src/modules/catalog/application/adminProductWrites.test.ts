import { describe, expect, it, vi } from 'vitest';
import { sampleProduct } from '../../../../test/helpers/catalog.js';
import {
  InvalidSpecKeysError,
  ProductChangedError,
  ProductNotFoundError,
  StockChangedError,
} from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import { createAdminProduct } from './createAdminProduct.js';
import { updateAdminProduct, type UpdateAdminProductInput } from './updateAdminProduct.js';

const ADMIN = 'admin-sub-1';
const ID = '01K6PZ3Q5G0000000000000001';
const SEEN = '2026-10-04T07:00:00.000Z';
const NOW = '2026-11-25T08:00:00.000Z';
/** Món đã xoá mềm (BR-14, xoá làm ở PR sau) vẫn có thể có trong bảng */
const DELETED_AT = '2026-11-20T08:00:00.000Z';

const CURRENT = sampleProduct({ productId: ID, category: 'gpu', stock: 12, updatedAt: SEEN });

function writer() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn<(...args: unknown[]) => Promise<Product | null>>(),
  };
}

/** findById trả lần lượt từng bản trong `reads` (lần đọc đầu, lần đọc lại sau khi ghi hỏng) */
function products(...reads: (Product | null)[]) {
  const findById =
    vi.fn<(id: string, options?: { consistent?: boolean }) => Promise<Product | null>>();
  for (const read of reads) findById.mockResolvedValueOnce(read);
  return { findById };
}

describe('createAdminProduct (BR-11)', () => {
  const draft = {
    name: 'Card MSI RTX 4060',
    category: 'gpu' as const,
    brand: 'MSI',
    price: 8_290_000,
    stock: 5,
    status: 'ACTIVE' as const,
    description: 'Card tầm trung.',
    specs: { vram: '8GB GDDR6' },
  };

  it('createAdminProduct_writesNewProductWithGeneratedIdAndTime', async () => {
    // Arrange
    const w = writer();

    // Act
    const result = await createAdminProduct(
      { writer: w, newId: () => 'NEW-ID', now: () => NOW },
      { adminId: ADMIN, draft },
    );

    // Assert
    expect(result).toEqual({ ...draft, productId: 'NEW-ID', createdAt: NOW, updatedAt: NOW });
    // Verify
    expect(w.create).toHaveBeenCalledTimes(1);
    expect(w.create).toHaveBeenCalledWith(result);
  });

  it('createAdminProduct_throwsInvalidSpecKeys_andWritesNothing_whenKeyOfOtherCategory', async () => {
    // Arrange
    const w = writer();

    // Act
    const act = createAdminProduct(
      { writer: w, newId: () => 'NEW-ID', now: () => NOW },
      { adminId: ADMIN, draft: { ...draft, specs: { vram: '8GB', dpi: '26000' } } },
    );

    // Assert
    await expect(act).rejects.toMatchObject({
      constructor: InvalidSpecKeysError,
      extensions: { errors: [{ field: 'specs.dpi', message: 'Khoá không thuộc loại hàng' }] },
    });
    // Verify
    expect(w.create).not.toHaveBeenCalled();
  });
});

describe('updateAdminProduct (BR-12, BR-13)', () => {
  const input = (overrides: Partial<UpdateAdminProductInput> = {}): UpdateAdminProductInput => ({
    adminId: ADMIN,
    productId: ID,
    patch: { price: 7_990_000 },
    updatedAt: SEEN,
    ...overrides,
  });

  it('updateAdminProduct_writesWithSeenUpdatedAt_andReturnsSaved', async () => {
    // Arrange
    const w = writer();
    const saved = { ...CURRENT, price: 7_990_000, updatedAt: NOW };
    w.update.mockResolvedValue(saved);

    // Act
    const result = await updateAdminProduct(
      { products: products(CURRENT), writer: w, now: () => NOW },
      input(),
    );

    // Assert
    expect(result).toEqual(saved);
    // Verify: không gửi expectedStock khi không sửa tồn kho
    expect(w.update).toHaveBeenCalledWith({
      product: CURRENT,
      patch: { price: 7_990_000 },
      seenUpdatedAt: SEEN,
      now: NOW,
    });
  });

  it('updateAdminProduct_passesExpectedStock_whenStockChanges', async () => {
    // Arrange
    const w = writer();
    w.update.mockResolvedValue({ ...CURRENT, stock: 20 });

    // Act
    await updateAdminProduct(
      { products: products(CURRENT), writer: w, now: () => NOW },
      input({ patch: { stock: 20 }, expectedStock: 12 }),
    );

    // Verify
    expect(w.update).toHaveBeenCalledWith(expect.objectContaining({ expectedStock: 12 }));
  });

  it.each([
    ['không có', null],
    ['đã xoá mềm', { ...CURRENT, status: 'INACTIVE' as const, deletedAt: DELETED_AT }],
  ])('updateAdminProduct_throwsNotFound_andWritesNothing_when_%s', async (_name, current) => {
    // Arrange
    const w = writer();

    // Act
    const act = updateAdminProduct(
      { products: products(current), writer: w, now: () => NOW },
      input(),
    );

    // Assert
    await expect(act).rejects.toBeInstanceOf(ProductNotFoundError);
    // Verify
    expect(w.update).not.toHaveBeenCalled();
  });

  it('updateAdminProduct_throwsProductChangedWithCurrent_beforeWriting_whenUpdatedAtDiffers', async () => {
    // Arrange
    const w = writer();
    const newer = { ...CURRENT, updatedAt: NOW };

    // Act
    const act = updateAdminProduct(
      { products: products(newer), writer: w, now: () => NOW },
      input(),
    );

    // Assert
    await expect(act).rejects.toMatchObject({
      constructor: ProductChangedError,
      code: 'PRODUCT_CHANGED',
      extensions: { current: newer },
    });
    // Verify
    expect(w.update).not.toHaveBeenCalled();
  });

  it('updateAdminProduct_throwsStockChanged_beforeWriting_whenExpectedStockDiffers', async () => {
    // Arrange
    const w = writer();

    // Act
    const act = updateAdminProduct(
      { products: products({ ...CURRENT, stock: 10 }), writer: w, now: () => NOW },
      input({ patch: { stock: 20 }, expectedStock: 12 }),
    );

    // Assert
    await expect(act).rejects.toMatchObject({
      constructor: StockChangedError,
      code: 'STOCK_CHANGED',
      extensions: { currentStock: 10 },
    });
    // Verify
    expect(w.update).not.toHaveBeenCalled();
  });

  it('updateAdminProduct_checksSpecKeysAgainstStoredCategory', async () => {
    // Arrange: món là gpu, gửi khoá của chuột
    const w = writer();

    // Act
    const act = updateAdminProduct(
      { products: products(CURRENT), writer: w, now: () => NOW },
      input({ patch: { specs: { dpi: '26000' } } }),
    );

    // Assert
    await expect(act).rejects.toBeInstanceOf(InvalidSpecKeysError);
    // Verify
    expect(w.update).not.toHaveBeenCalled();
  });

  it.each<[string, Product | null, unknown]>([
    ['vừa bị xoá', null, ProductNotFoundError],
    ['vừa bị xoá mềm', { ...CURRENT, deletedAt: DELETED_AT }, ProductNotFoundError],
    ['vừa được sửa ở nơi khác', { ...CURRENT, updatedAt: NOW }, ProductChangedError],
    ['tồn kho vừa đổi', { ...CURRENT, stock: 9 }, StockChangedError],
    ['không rõ lý do', CURRENT, ProductChangedError],
  ])(
    'updateAdminProduct_rereadsAfterConditionFails_andThrows_when_%s',
    async (_name, latest, expected) => {
      // Arrange: lần đọc đầu thấy bản cũ hợp lệ; lệnh ghi hỏng điều kiện vì bản đổi giữa chừng
      const w = writer();
      w.update.mockResolvedValue(null);
      const repo = products(CURRENT, latest);

      // Act
      const act = updateAdminProduct(
        { products: repo, writer: w, now: () => NOW },
        input({ patch: { stock: 20 }, expectedStock: 12 }),
      );

      // Assert
      await expect(act).rejects.toBeInstanceOf(expected);
      // Verify: đọc 2 lần (lần đọc lại là đọc nhất quán), ghi 1 lần
      expect(repo.findById).toHaveBeenCalledTimes(2);
      expect(repo.findById).toHaveBeenLastCalledWith(ID, { consistent: true });
      expect(w.update).toHaveBeenCalledTimes(1);
    },
  );

  it('updateAdminProduct_throwsStockChanged_fromConsistentReread_whenEventualReadIsStale', async () => {
    // Arrange: khách vừa mua làm tồn kho 12 → 10, updatedAt giữ nguyên (giao dịch đặt hàng).
    // Đọc thường vẫn ra bản cũ (12); chỉ đọc nhất quán mới thấy 10
    const w = writer();
    w.update.mockResolvedValue(null);
    const fresh = { ...CURRENT, stock: 10 };
    const findById = vi.fn(async (_id: string, options?: { consistent?: boolean }) =>
      options?.consistent ? fresh : CURRENT,
    );

    // Act
    const act = updateAdminProduct(
      { products: { findById }, writer: w, now: () => NOW },
      input({ patch: { stock: 20 }, expectedStock: 12 }),
    );

    // Assert: STOCK_CHANGED với tồn kho mới, không phải PRODUCT_CHANGED với bản cũ
    await expect(act).rejects.toMatchObject({
      constructor: StockChangedError,
      code: 'STOCK_CHANGED',
      extensions: { currentStock: 10 },
    });
    // Verify
    expect(findById).toHaveBeenCalledTimes(2);
    expect(findById).toHaveBeenNthCalledWith(1, ID);
    expect(findById).toHaveBeenNthCalledWith(2, ID, { consistent: true });
  });
});
