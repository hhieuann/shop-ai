import { describe, expect, it, vi } from 'vitest';
import { uniqueProduct } from '../../../../test/helpers/catalog.js';
import { PRODUCT_CATEGORIES, type ProductCategory } from '../domain/product.js';
import { createActiveProducts } from './activeProducts.js';

/** Reader giả: mỗi loại trả một sản phẩm cùng loại */
function fakeReader() {
  return {
    listActiveByCategory: vi.fn(async (category: ProductCategory) => [
      uniqueProduct({ category, name: `Hàng ${category}` }),
    ]),
  };
}

describe('createActiveProducts', () => {
  it('get_queriesEveryCategoryOnce_whenCacheEmpty', async () => {
    // Arrange
    const reader = fakeReader();
    const active = createActiveProducts({ reader, now: () => 0 });

    // Act
    const products = await active.get();

    // Assert
    expect(products).toHaveLength(PRODUCT_CATEGORIES.length);

    // Verify: 13 lần Query, mỗi loại đúng một lần
    expect(reader.listActiveByCategory).toHaveBeenCalledTimes(PRODUCT_CATEGORIES.length);
    const queried = reader.listActiveByCategory.mock.calls.map(([category]) => category);
    expect(new Set(queried)).toEqual(new Set(PRODUCT_CATEGORIES));
  });

  it('get_addsSearchText_whenLoading', async () => {
    // Arrange
    const reader = {
      listActiveByCategory: vi.fn(async (category: ProductCategory) =>
        category === 'mouse' ? [uniqueProduct({ category, name: 'Chuột Logitech G502' })] : [],
      ),
    };
    const active = createActiveProducts({ reader, now: () => 0 });

    // Act
    const [mouse] = await active.get();

    // Assert: tên đã chuẩn hoá sẵn để tìm, không phải tính lại ở mỗi request
    expect(mouse?.searchText).toBe('chuot logitech g502');
  });

  it('get_servesFromMemory_whenWithinTtl', async () => {
    // Arrange
    const reader = fakeReader();
    let clock = 0;
    const active = createActiveProducts({ reader, ttlMs: 60_000, now: () => clock });
    const first = await active.get();

    // Act
    clock = 59_999;
    const second = await active.get();

    // Assert
    expect(second).toBe(first);

    // Verify: không Query thêm
    expect(reader.listActiveByCategory).toHaveBeenCalledTimes(PRODUCT_CATEGORIES.length);
  });

  it('get_reloads_whenTtlExpired', async () => {
    // Arrange
    const reader = fakeReader();
    let clock = 0;
    const active = createActiveProducts({ reader, ttlMs: 60_000, now: () => clock });
    await active.get();

    // Act
    clock = 60_000;
    await active.get();

    // Verify
    expect(reader.listActiveByCategory).toHaveBeenCalledTimes(PRODUCT_CATEGORIES.length * 2);
  });

  it('get_loadsOnce_whenConcurrentRequestsHitEmptyCache', async () => {
    // Arrange
    const reader = fakeReader();
    const active = createActiveProducts({ reader, now: () => 0 });

    // Act: 5 request tới cùng lúc khi Lambda vừa khởi động
    const results = await Promise.all(Array.from({ length: 5 }, () => active.get()));

    // Assert
    expect(new Set(results).size).toBe(1);

    // Verify
    expect(reader.listActiveByCategory).toHaveBeenCalledTimes(PRODUCT_CATEGORIES.length);
  });

  it('get_retriesOnNextCall_whenLoadFailed', async () => {
    // Arrange: lần nạp đầu, Query một loại bị lỗi (ví dụ DynamoDB throttle)
    const reader = fakeReader();
    reader.listActiveByCategory.mockRejectedValueOnce(new Error('ThrottlingException'));
    const active = createActiveProducts({ reader, now: () => 0 });

    // Act
    await expect(active.get()).rejects.toThrow('ThrottlingException');
    const retried = await active.get();

    // Assert: lỗi không bị lưu vào cache
    expect(retried).toHaveLength(PRODUCT_CATEGORIES.length);

    // Verify
    expect(reader.listActiveByCategory).toHaveBeenCalledTimes(PRODUCT_CATEGORIES.length * 2);
  });
});
