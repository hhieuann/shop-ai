import { describe, it, expect } from 'vitest';
import { filtersFromSearchParams, normalizeSearch, toProductsQuery } from './productFilters';

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
