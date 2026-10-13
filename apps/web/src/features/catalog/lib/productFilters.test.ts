import { describe, it, expect } from 'vitest';
import {
  filtersFromSearchParams,
  normalizeSearch,
  pageFromSearchParams,
  searchWithoutPaging,
  toProductsQuery,
  withFilter,
  withPage,
} from './productFilters';

describe('normalizeSearch', () => {
  it('normalizeSearch_trimsSpaces_whenKeywordValid', () => {
    // Arrange
    const raw = '  RTX  ';

    // Act
    const result = normalizeSearch(raw);

    // Assert: giữ nguyên hoa thường, server tự chuẩn hoá
    expect(result).toBe('RTX');
  });

  it('normalizeSearch_acceptsSingleChar_whenUserTypesOneLetter', () => {
    // Arrange: gõ "i" để tìm Intel; tìm trong cache nên không tốn thêm
    const raw = 'i';

    // Act
    const result = normalizeSearch(raw);

    // Assert
    expect(result).toBe('i');
  });

  it.each([['   '], [''], [null]])(
    'normalizeSearch_returnsUndefined_whenEmptyOrOnlySpaces (%j)',
    (raw) => {
      // Act
      const result = normalizeSearch(raw);

      // Assert: không gửi q, hiện toàn bộ danh sách
      expect(result).toBeUndefined();
    },
  );

  it('normalizeSearch_cutsTo30Chars_whenTooLong', () => {
    // Arrange
    const long = 'a'.repeat(80);

    // Act
    const result = normalizeSearch(long);

    // Assert: không gửi chuỗi làm API trả 400
    expect(result).toHaveLength(30);
  });
});

describe('filtersFromSearchParams', () => {
  it('filtersFromSearchParams_ignoresUnknownCategory_whenUrlTampered', () => {
    // Arrange
    const params = new URLSearchParams('q=rtx&category=hacker');

    // Act
    const result = filtersFromSearchParams(params);

    // Assert
    expect(result).toEqual({ q: 'rtx', category: undefined, sort: undefined });
  });

  it('filtersFromSearchParams_readsSortAndNewCategories_whenValid', () => {
    // Arrange
    const params = new URLSearchParams('category=accessory&sort=price_asc');

    // Act
    const result = filtersFromSearchParams(params);

    // Assert
    expect(result).toEqual({ q: undefined, category: 'accessory', sort: 'price_asc' });
  });

  it('filtersFromSearchParams_dropsDefaultSort_whenSortIsNewest', () => {
    // Arrange: ?sort=newest và không có sort cho cùng kết quả
    const params = new URLSearchParams('sort=newest');

    // Act
    const result = filtersFromSearchParams(params);

    // Assert: bỏ đi để URL gọn và dùng chung một queryKey (một cache)
    expect(result.sort).toBeUndefined();
  });
});

describe('toProductsQuery', () => {
  it('toProductsQuery_includesOnlyFilledParams_whenSomeEmpty', () => {
    // Act
    const query = toProductsQuery({ q: 'chuột gaming' }, undefined, 20);

    // Assert: tiếng Việt và dấu cách được mã hoá đúng
    const params = new URLSearchParams(query);
    expect(params.get('q')).toBe('chuột gaming');
    expect(params.has('category')).toBe(false);
    expect(params.has('cursor')).toBe(false);
  });

  it('toProductsQuery_addsCursor_whenLoadingNextPage', () => {
    // Act
    const query = toProductsQuery({ category: 'gpu' }, '01J9XKPQ0000000000000004');

    // Assert
    const params = new URLSearchParams(query);
    expect(params.get('category')).toBe('gpu');
    expect(params.get('cursor')).toBe('01J9XKPQ0000000000000004');
  });
});

describe('pageFromSearchParams', () => {
  it('pageFromSearchParams_returnsPage1_whenNoCursor', () => {
    // Arrange: có page nhưng không có cursor (sửa tay URL) thì vẫn là trang 1
    const params = new URLSearchParams('category=gpu&page=3');

    // Act
    const result = pageFromSearchParams(params);

    // Assert
    expect(result).toEqual({ page: 1 });
  });

  it('pageFromSearchParams_readsCursorAndPage_whenBothValid', () => {
    // Arrange
    const params = new URLSearchParams('cursor=abc&page=3');

    // Act
    const result = pageFromSearchParams(params);

    // Assert
    expect(result).toEqual({ cursor: 'abc', page: 3 });
  });

  it.each([[''], ['page=1'], ['page=0'], ['page=-2'], ['page=2.5'], ['page=abc']])(
    'pageFromSearchParams_returnsPage2_whenCursorButPageInvalid (%s)',
    (page) => {
      // Arrange
      const params = new URLSearchParams(`cursor=abc&${page}`);

      // Act
      const result = pageFromSearchParams(params);

      // Assert: có cursor thì chắc chắn không phải trang 1
      expect(result).toEqual({ cursor: 'abc', page: 2 });
    },
  );
});

describe('withFilter', () => {
  it('withFilter_setsValueAndDropsPaging_whenCategoryChanges', () => {
    // Arrange
    const params = new URLSearchParams('q=rtx&category=gpu&sort=price_asc&cursor=abc&page=3');

    // Act
    const result = withFilter(params, 'category', 'mouse');

    // Assert: giữ q, sort; về trang 1
    expect(result.toString()).toBe('q=rtx&category=mouse&sort=price_asc');
  });

  it.each([
    ['category', undefined, 'q=rtx&sort=price_asc'],
    ['category', '', 'q=rtx&sort=price_asc'],
    ['sort', 'newest', 'q=rtx&category=gpu'],
  ] as const)('withFilter_removesKey_whenValueEmptyOrDefault (%s=%s)', (key, value, expected) => {
    // Arrange
    const params = new URLSearchParams('q=rtx&category=gpu&sort=price_asc&cursor=abc&page=2');

    // Act
    const result = withFilter(params, key, value);

    // Assert
    expect(result.toString()).toBe(expected);
  });
});

describe('withPage', () => {
  it('withPage_setsCursorAndPage_whenGoingToPage2OrLater', () => {
    // Arrange
    const params = new URLSearchParams('category=gpu');

    // Act
    const result = withPage(params, 'next1', 2);

    // Assert
    expect(result.toString()).toBe('category=gpu&cursor=next1&page=2');
  });

  it('withPage_dropsCursorAndPage_whenBackToPage1', () => {
    // Arrange
    const params = new URLSearchParams('category=gpu&cursor=next1&page=2');

    // Act
    const result = withPage(params, undefined, 1);

    // Assert
    expect(result.toString()).toBe('category=gpu');
  });
});

describe('searchWithoutPaging', () => {
  it.each([
    ['?category=gpu&cursor=abc&page=2', '?category=gpu'],
    ['?cursor=abc&page=2', ''],
    ['?category=gpu', '?category=gpu'],
    ['', ''],
  ])('searchWithoutPaging_dropsCursorAndPage (%s)', (search, expected) => {
    // Act
    const result = searchWithoutPaging(search);

    // Assert
    expect(result).toBe(expected);
  });

  it('searchWithoutPaging_keepsOriginalString_whenNoPagingParams', () => {
    // Arrange: không dựng lại chuỗi, để từ khoá có dấu cách không bị đổi cách mã hoá
    const search = '?q=rtx%204070';

    // Act
    const result = searchWithoutPaging(search);

    // Assert
    expect(result).toBe(search);
  });
});
