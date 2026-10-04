import { describe, expect, it } from 'vitest';
import { uniqueProduct } from '../../../../test/helpers/catalog.js';
import { InvalidCursorError } from './errors.js';
import { decodeCursor, encodeCursor, filterProducts, paginate, sortProducts } from './listing.js';
import type { Product } from './product.js';
import { toSearchText, withSearchText } from './search.js';

const names = (products: readonly Product[]) => products.map((p) => p.name);

/** Sản phẩm mẫu đã kèm searchText, như lúc nằm trong cache */
const cachedProduct = (overrides: Partial<Product> = {}) =>
  withSearchText(uniqueProduct(overrides));

describe('filterProducts', () => {
  it('filterProducts_excludesInactive_always', () => {
    // Arrange
    const active = cachedProduct({ name: 'Đang bán' });
    const inactive = cachedProduct({ name: 'Ngừng bán', status: 'INACTIVE' });

    // Act
    const result = filterProducts([active, inactive], {});

    // Assert
    expect(names(result)).toEqual(['Đang bán']);
  });

  it('filterProducts_keepsOnlyCategory_whenCategoryGiven', () => {
    // Arrange
    const gpu = cachedProduct({ name: 'RTX 4070', category: 'gpu' });
    const mouse = cachedProduct({ name: 'G502', category: 'mouse' });

    // Act
    const result = filterProducts([gpu, mouse], { category: 'mouse' });

    // Assert
    expect(names(result)).toEqual(['G502']);
  });

  it('filterProducts_returnsEmpty_whenKeywordNotInCategory', () => {
    // Arrange (catalog.md: q=rtx&category=mouse thường ra mảng rỗng)
    const gpu = cachedProduct({ name: 'ASUS TUF Gaming GeForce RTX 4070', category: 'gpu' });
    const mouse = cachedProduct({ name: 'Chuột Logitech G502', category: 'mouse' });

    // Act
    const result = filterProducts([gpu, mouse], { category: 'mouse', needle: 'rtx' });

    // Assert
    expect(result).toEqual([]);
  });
});

describe('sortProducts', () => {
  it('sortProducts_putsOutOfStockLast_whenPriceAsc', () => {
    // Arrange (tiêu chí nghiệm thu BR-08: 1, 2, 3 triệu rồi mới tới hàng hết giá 0,5 triệu)
    const products = [
      cachedProduct({ name: '1tr', price: 1_000_000 }),
      cachedProduct({ name: '3tr', price: 3_000_000 }),
      cachedProduct({ name: '2tr', price: 2_000_000 }),
      cachedProduct({ name: '0,5tr hết hàng', price: 500_000, stock: 0 }),
    ];

    // Act
    const result = sortProducts(products, 'price_asc');

    // Assert
    expect(names(result)).toEqual(['1tr', '2tr', '3tr', '0,5tr hết hàng']);
  });

  it('sortProducts_putsOutOfStockLast_whenPriceDesc', () => {
    // Arrange
    const products = [
      cachedProduct({ name: '9tr hết hàng', price: 9_000_000, stock: 0 }),
      cachedProduct({ name: '1tr', price: 1_000_000 }),
      cachedProduct({ name: '3tr', price: 3_000_000 }),
    ];

    // Act
    const result = sortProducts(products, 'price_desc');

    // Assert
    expect(names(result)).toEqual(['3tr', '1tr', '9tr hết hàng']);
  });

  it('sortProducts_putsNewestInStockFirst_whenNewest', () => {
    // Arrange
    const products = [
      cachedProduct({ name: 'cũ', createdAt: '2026-10-01T00:00:00.000Z' }),
      cachedProduct({ name: 'mới hết hàng', createdAt: '2026-10-05T00:00:00.000Z', stock: 0 }),
      cachedProduct({ name: 'mới', createdAt: '2026-10-04T00:00:00.000Z' }),
    ];

    // Act
    const result = sortProducts(products, 'newest');

    // Assert
    expect(names(result)).toEqual(['mới', 'cũ', 'mới hết hàng']);
  });

  it('sortProducts_ordersByProductId_whenPricesEqual', () => {
    // Arrange: cachedProduct tạo id tăng dần, nên "a" có id nhỏ hơn "b"
    const a = cachedProduct({ name: 'a', price: 1_000_000 });
    const b = cachedProduct({ name: 'b', price: 1_000_000 });

    // Act
    const asc = sortProducts([b, a], 'price_asc');
    const desc = sortProducts([b, a], 'price_desc');

    // Assert: thứ tự cố định dù dữ liệu vào theo thứ tự nào
    expect(names(asc)).toEqual(['a', 'b']);
    expect(names(desc)).toEqual(['a', 'b']);
  });

  it('sortProducts_doesNotMutateInput', () => {
    // Arrange
    const products = [cachedProduct({ price: 2 }), cachedProduct({ price: 1 })];
    const before = [...products];

    // Act
    sortProducts(products, 'price_asc');

    // Assert
    expect(products).toEqual(before);
  });
});

describe('paginate', () => {
  const catalog = sortProducts(
    Array.from({ length: 7 }, (_, i) => cachedProduct({ name: `p${i}`, price: (i + 1) * 100_000 })),
    'price_asc',
  );

  it('paginate_walksEveryProductOnce_whenFollowingCursors', () => {
    // Arrange
    const seen: string[] = [];
    let cursor: string | undefined;

    // Act
    do {
      const page = paginate(catalog, { sort: 'price_asc', limit: 3, cursor });
      seen.push(...names(page.items));
      cursor = page.nextCursor;
    } while (cursor);

    // Assert
    expect(seen).toEqual(names(catalog));
  });

  it('paginate_omitsNextCursor_whenLastPageExactlyFull', () => {
    // Act
    const page = paginate(catalog.slice(0, 6), { sort: 'price_asc', limit: 3, cursor: undefined });
    const last = paginate(catalog.slice(0, 6), {
      sort: 'price_asc',
      limit: 3,
      cursor: page.nextCursor,
    });

    // Assert
    expect(page.nextCursor).toBeDefined();
    expect(last.items).toHaveLength(3);
    expect(last.nextCursor).toBeUndefined();
  });

  it('paginate_returnsEmpty_whenNoProducts', () => {
    // Act
    const page = paginate([], { sort: 'newest', limit: 20 });

    // Assert
    expect(page).toEqual({ items: [] });
  });

  it('paginate_continuesAfterPosition_whenLastProductRemovedBetweenPages', () => {
    // Arrange: sản phẩm cuối trang 1 bị ngừng bán trước khi khách bấm "xem thêm"
    const first = paginate(catalog, { sort: 'price_asc', limit: 3 });
    const removedId = first.items.at(-1)!.productId;
    const afterRemoval = catalog.filter((p) => p.productId !== removedId);

    // Act
    const second = paginate(afterRemoval, {
      sort: 'price_asc',
      limit: 3,
      cursor: first.nextCursor,
    });

    // Assert: không lặp lại, không bỏ sót sản phẩm nào còn lại
    expect(names(second.items)).toEqual(['p3', 'p4', 'p5']);
  });

  it('paginate_throwsInvalidCursor_whenCursorFromAnotherSort', () => {
    // Arrange
    const { nextCursor } = paginate(catalog, { sort: 'price_asc', limit: 3 });

    // Act
    const act = () => paginate(catalog, { sort: 'newest', limit: 3, cursor: nextCursor });

    // Assert
    expect(act).toThrow(InvalidCursorError);
  });
});

describe('decodeCursor', () => {
  it('decodeCursor_returnsPosition_whenEncodedBySameSort', () => {
    // Arrange
    const position = { group: 0 as const, value: 1_000_000, productId: 'abc' };

    // Act
    const result = decodeCursor(encodeCursor(position, 'price_desc'), 'price_desc');

    // Assert
    expect(result).toEqual(position);
  });

  it.each([
    ['chuỗi rác', 'không-phải-base64'],
    ['rỗng', ''],
    ['quá dài', 'a'.repeat(201)],
    ['JSON sai kiểu', Buffer.from('[1,2,3]').toString('base64url')],
    [
      'giá trị sai kiểu',
      Buffer.from(JSON.stringify({ s: 'price_asc', g: 0, v: 'abc', id: 'x' })).toString(
        'base64url',
      ),
    ],
  ])('decodeCursor_throwsInvalidCursor_when%s', (_label, cursor) => {
    // Act
    const act = () => decodeCursor(cursor, 'price_asc');

    // Assert
    expect(act).toThrow(InvalidCursorError);
  });
});

describe('toSearchText trong lọc', () => {
  it('filterProducts_matchesVietnameseName_whenKeywordWithoutAccents', () => {
    // Arrange
    const mouse = cachedProduct({ name: 'Chuột Logitech G502', category: 'mouse' });

    // Act
    const result = filterProducts([mouse], { needle: toSearchText('chuot') });

    // Assert
    expect(names(result)).toEqual(['Chuột Logitech G502']);
  });
});
