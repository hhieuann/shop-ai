import { describe, expect, it, vi } from 'vitest';
import { uniqueProduct } from '../../../../test/helpers/catalog.js';
import { InvalidCursorError } from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import { withSearchText } from '../domain/search.js';
import { listProducts } from './listProducts.js';

/** Cache giả trả đúng danh sách cho trước, đã kèm searchText như cache thật */
function fakeActiveProducts(products: readonly Product[]) {
  return { get: vi.fn().mockResolvedValue(products.map(withSearchText)) };
}

const rtx = uniqueProduct({
  name: 'ASUS TUF Gaming GeForce RTX 4070',
  category: 'gpu',
  imageUrl: 'https://example.com/rtx.png',
});
const mouse = uniqueProduct({
  name: 'Chuột Logitech G502',
  category: 'mouse',
  brand: 'Logitech',
  imageUrl: undefined,
});

describe('listProducts', () => {
  it('listProducts_findsProduct_whenKeywordLowercase', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([rtx, mouse]);

    // Act
    const result = await listProducts({ activeProducts }, { q: 'rtx' });

    // Assert
    expect(result.items.map((p) => p.name)).toEqual(['ASUS TUF Gaming GeForce RTX 4070']);

    // Verify
    expect(activeProducts.get).toHaveBeenCalledTimes(1);
  });

  it('listProducts_findsVietnameseName_whenKeywordWithoutAccents', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([rtx, mouse]);

    // Act
    const result = await listProducts({ activeProducts }, { q: 'CHUOT' });

    // Assert
    expect(result.items.map((p) => p.name)).toEqual(['Chuột Logitech G502']);
  });

  it('listProducts_returnsEmpty_whenKeywordMatchesNothingInCategory', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([rtx, mouse]);

    // Act
    const result = await listProducts({ activeProducts }, { q: 'rtx', category: 'mouse' });

    // Assert
    expect(result).toEqual({ items: [] });
  });

  it('listProducts_ignoresKeyword_whenOnlyWhitespace', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([rtx, mouse]);

    // Act
    const result = await listProducts({ activeProducts }, { q: '   ' });

    // Assert
    expect(result.items).toHaveLength(2);
  });

  it('listProducts_returnsSummaryWithoutInternalFields', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([rtx, mouse]);

    // Act
    const result = await listProducts({ activeProducts }, { sort: 'price_asc', category: 'gpu' });

    // Assert: khớp ProductSummary trong OpenAPI, không lộ searchText, mô tả hay specs
    expect(result.items).toEqual([
      {
        productId: rtx.productId,
        name: rtx.name,
        category: 'gpu',
        brand: 'ASUS',
        price: rtx.price,
        stock: rtx.stock,
        status: 'ACTIVE',
        imageUrl: 'https://example.com/rtx.png',
      },
    ]);
  });

  it('listProducts_omitsImageUrl_whenProductHasNoImage', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([mouse]);

    // Act
    const result = await listProducts({ activeProducts }, {});

    // Assert
    expect(result.items[0]).not.toHaveProperty('imageUrl');
  });

  it('listProducts_returns20AndCursor_whenNoLimitGiven', async () => {
    // Arrange
    const many = Array.from({ length: 25 }, () => uniqueProduct());
    const activeProducts = fakeActiveProducts(many);

    // Act
    const first = await listProducts({ activeProducts }, {});
    const second = await listProducts({ activeProducts }, { cursor: first.nextCursor });

    // Assert (BR-01)
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBeDefined();
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeUndefined();
  });

  it('listProducts_returnsEmptyArray_whenCategoryHasNoProducts', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([rtx]);

    // Act
    const result = await listProducts({ activeProducts }, { category: 'headset' });

    // Assert
    expect(result).toEqual({ items: [] });
  });

  it('listProducts_throwsInvalidCursor_whenCursorMalformed', async () => {
    // Arrange
    const activeProducts = fakeActiveProducts([rtx]);

    // Act
    const act = listProducts({ activeProducts }, { cursor: 'abc' });

    // Assert
    await expect(act).rejects.toBeInstanceOf(InvalidCursorError);
  });
});
