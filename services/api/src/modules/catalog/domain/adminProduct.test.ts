import { describe, expect, it } from 'vitest';
import { uniqueProduct } from '../../../../test/helpers/catalog.js';
import {
  actionOfPatch,
  decodeAdminCursor,
  encodeAdminCursor,
  filterAndSortNewest,
  groupsFor,
  newProduct,
  paginateNewest,
} from './adminProduct.js';
import { InvalidCursorError } from './errors.js';
import { encodeCursor } from './listing.js';
import type { Product } from './product.js';
import { toSearchText } from './search.js';

const ids = (products: readonly Product[]) => products.map((p) => p.productId);

describe('groupsFor', () => {
  it('groupsFor_returnsActiveAndInactive_whenStatusMissing', () => {
    // Act
    const result = groupsFor(undefined);

    // Assert: mặc định không gồm món đã xoá (BR-10)
    expect(result).toEqual(['ACTIVE', 'INACTIVE']);
  });

  it.each(['ACTIVE', 'INACTIVE', 'DELETED'] as const)('groupsFor_returnsOnly_%s', (status) => {
    // Act
    const result = groupsFor(status);

    // Assert
    expect(result).toEqual([status]);
  });
});

describe('filterAndSortNewest', () => {
  it('filterAndSortNewest_ordersByProductIdDescending', () => {
    // Arrange: uniqueProduct tạo productId tăng dần, như ULID theo thời gian
    const oldest = uniqueProduct();
    const middle = uniqueProduct();
    const newest = uniqueProduct();

    // Act
    const result = filterAndSortNewest([middle, oldest, newest]);

    // Assert
    expect(ids(result)).toEqual([newest.productId, middle.productId, oldest.productId]);
  });

  it('filterAndSortNewest_matchesNameWithoutCaseOrDiacritics_likeBr03', () => {
    // Arrange
    const mouse = uniqueProduct({ name: 'Chuột Logitech G304' });
    const gpu = uniqueProduct({ name: 'Card RTX 4060' });

    // Act
    const result = filterAndSortNewest([mouse, gpu], toSearchText('CHUOT'));

    // Assert
    expect(ids(result)).toEqual([mouse.productId]);
  });

  it('filterAndSortNewest_doesNotMutateInput', () => {
    // Arrange
    const a = uniqueProduct();
    const b = uniqueProduct();
    const input = [a, b];

    // Act
    filterAndSortNewest(input);

    // Assert
    expect(ids(input)).toEqual([a.productId, b.productId]);
  });
});

describe('admin cursor', () => {
  it('decodeAdminCursor_returnsProductId_whenEncodedByAdmin', () => {
    // Act
    const result = decodeAdminCursor(encodeAdminCursor('01K6PZ3Q5G0000000000000007'));

    // Assert
    expect(result).toBe('01K6PZ3Q5G0000000000000007');
  });

  it.each([
    ['rỗng', ''],
    ['quá dài', 'a'.repeat(201)],
    ['không phải base64 JSON', '%%%'],
    ['JSON không phải object', Buffer.from('"x"').toString('base64url')],
    ['thiếu id', Buffer.from(JSON.stringify({ a: 1 })).toString('base64url')],
    [
      'cursor của API khách',
      encodeCursor({ group: 0, value: '2026-10-01', productId: '01K6' }, 'newest'),
    ],
  ])('decodeAdminCursor_throwsInvalidCursor_when_%s', (_name, cursor) => {
    // Act
    const act = () => decodeAdminCursor(cursor);

    // Assert
    expect(act).toThrow(InvalidCursorError);
  });
});

describe('paginateNewest', () => {
  const products = filterAndSortNewest(Array.from({ length: 5 }, () => uniqueProduct()));

  it('paginateNewest_returnsFirstPageWithCursor_whenMoreLeft', () => {
    // Act
    const page = paginateNewest(products, { limit: 2 });

    // Assert
    expect(ids(page.items)).toEqual(ids(products.slice(0, 2)));
    expect(page.nextCursor).toBeDefined();
  });

  it('paginateNewest_walksAllPagesWithoutGapsOrDuplicates', () => {
    // Act
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = paginateNewest(products, { limit: 2, cursor });
      seen.push(...ids(page.items));
      cursor = page.nextCursor;
    } while (cursor);

    // Assert
    expect(seen).toEqual(ids(products));
  });

  it('paginateNewest_continuesAfterCursor_whenCursorItemLeftTheList', () => {
    // Arrange: món cuối trang 1 vừa bị ẩn hoặc xoá, không còn trong danh sách
    const first = paginateNewest(products, { limit: 2 });
    const withoutLast = products.filter((p) => p.productId !== products[1]?.productId);

    // Act
    const second = paginateNewest(withoutLast, { limit: 2, cursor: first.nextCursor });

    // Assert: vẫn bắt đầu từ món thứ 3, không lặp món thứ 1
    expect(ids(second.items)).toEqual(ids(products.slice(2, 4)));
  });

  it('paginateNewest_returnsEmptyWithoutCursor_whenCursorPastEnd', () => {
    // Act
    const page = paginateNewest(products, {
      limit: 2,
      cursor: encodeAdminCursor('00000000000000000000000000'),
    });

    // Assert
    expect(page).toEqual({ items: [] });
  });
});

describe('newProduct', () => {
  it('newProduct_setsIdAndSameCreatedUpdatedAt', () => {
    // Arrange
    const draft = {
      name: 'Chuột Logitech G304',
      category: 'mouse' as const,
      brand: 'Logitech',
      price: 790_000,
      stock: 20,
      status: 'ACTIVE' as const,
      description: 'Chuột không dây gọn nhẹ.',
    };

    // Act
    const product = newProduct(draft, '01K6PZ3Q5G0000000000000042', '2026-11-25T08:00:00.000Z');

    // Assert: BR-11
    expect(product).toEqual({
      ...draft,
      productId: '01K6PZ3Q5G0000000000000042',
      createdAt: '2026-11-25T08:00:00.000Z',
      updatedAt: '2026-11-25T08:00:00.000Z',
    });
  });
});

describe('actionOfPatch', () => {
  it.each([
    ['chỉ ẩn', { status: 'INACTIVE' as const }, 'HIDE'],
    ['chỉ hiện lại', { status: 'ACTIVE' as const }, 'SHOW'],
    ['sửa giá', { price: 1 }, 'UPDATE'],
    ['sửa giá kèm đổi trạng thái', { price: 1, status: 'INACTIVE' as const }, 'UPDATE'],
    ['bỏ ảnh', { imageUrl: null }, 'UPDATE'],
  ])('actionOfPatch_returns_when_%s', (_name, patch, expected) => {
    // Act
    const result = actionOfPatch(patch);

    // Assert
    expect(result).toBe(expected);
  });
});
