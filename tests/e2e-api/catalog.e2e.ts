/**
 * Xem hàng không cần đăng nhập (catalog.md BR-01, BR-02, BR-03, BR-04). Chỉ đọc, không ghi dữ liệu.
 */
import { describe, expect, it } from 'vitest';
import { call, fold, ready, type ProductList } from './api.js';

describe.skipIf(!ready)('E2E xem hàng', () => {
  it('productList_returnsActiveSummaries_withLimit', async () => {
    // Act
    const res = await call('/products?limit=5');

    // Assert: đúng dạng ProductSummary, chỉ hàng đang bán (BR-04)
    expect(res.status).toBe(200);
    const { items } = res.body as ProductList;
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    for (const item of items) {
      expect(item).toMatchObject({
        productId: expect.any(String),
        name: expect.any(String),
        category: expect.any(String),
        price: expect.any(Number),
        stock: expect.any(Number),
        status: 'ACTIVE',
      });
      expect(Number.isInteger(item.price)).toBe(true);
    }
  });

  it('productList_nextPage_hasNoOverlap_whenFollowingNextCursor', async () => {
    // Arrange
    const first = (await call('/products?limit=5')).body as ProductList;
    expect(first.nextCursor, 'dữ liệu demo có hơn 5 sản phẩm').toBeTruthy();

    // Act
    const res = await call(
      `/products?limit=5&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );

    // Assert: trang sau không lặp sản phẩm của trang trước
    expect(res.status).toBe(200);
    const firstIds = new Set(first.items.map((p) => p.productId));
    const second = (res.body as ProductList).items;
    expect(second.length).toBeGreaterThan(0);
    expect(second.filter((p) => firstIds.has(p.productId))).toEqual([]);
  });

  it('productList_returnsOnlyCategory_whenFilteredByGpu', async () => {
    // Act
    const res = await call('/products?category=gpu&limit=50');

    // Assert (BR-02)
    expect(res.status).toBe(200);
    const { items } = res.body as ProductList;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.category === 'gpu')).toBe(true);
  });

  it('productList_matchesWithoutDiacritics_whenSearchingChuot', async () => {
    // Act
    const res = await call('/products?q=chuot&limit=50');

    // Assert: "chuot" khớp "Chuột" (BR-03)
    expect(res.status).toBe(200);
    const { items } = res.body as ProductList;
    expect(items.length).toBeGreaterThan(0);
    expect(items.filter((p) => !fold(p.name).includes('chuot'))).toEqual([]);
  });

  it('productDetail_returnsSameProduct_whenOpenedFromList', async () => {
    // Arrange
    const [first] = ((await call('/products?limit=1')).body as ProductList).items;

    // Act
    const res = await call(`/products/${first?.productId}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ productId: first?.productId, name: first?.name });
  });
});
