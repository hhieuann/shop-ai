import { describe, expect, it } from 'vitest';
import {
  adminProductsQuery,
  adminProductsSearch,
  readAdminProductFilters,
} from './adminProductFilters';

const read = (search: string) => readAdminProductFilters(new URLSearchParams(search));

describe('readAdminProductFilters', () => {
  it('defaultsToLaptop_allStatuses_page1', () => {
    expect(read('')).toEqual({ category: 'laptop', page: 1 });
  });

  it('readsValidValues', () => {
    expect(read('category=gpu&status=DELETED&q=%20rtx%20&cursor=abc&page=3')).toEqual({
      category: 'gpu',
      status: 'DELETED',
      q: 'rtx',
      cursor: 'abc',
      page: 3,
    });
  });

  it('ignoresUnknownValues_andPageWithoutCursor', () => {
    expect(read('category=tablet&status=ALL&page=4')).toEqual({ category: 'laptop', page: 1 });
  });

  it('cutsSearchTo30Chars', () => {
    expect(read(`q=${'a'.repeat(40)}`).q).toHaveLength(30);
  });
});

describe('adminProductsSearch', () => {
  it('omitsDefaults', () => {
    expect(adminProductsSearch({ category: 'laptop', page: 1 })).toBe('');
  });

  it('keepsFilters_andPageOnlyWithCursor', () => {
    expect(adminProductsSearch({ category: 'gpu', status: 'ACTIVE', q: 'rtx', page: 2 })).toBe(
      '?category=gpu&status=ACTIVE&q=rtx',
    );
    expect(adminProductsSearch({ category: 'gpu', cursor: 'abc', page: 2 })).toBe(
      '?category=gpu&cursor=abc&page=2',
    );
  });
});

describe('adminProductsQuery', () => {
  it('alwaysSendsCategoryAndLimit', () => {
    expect(adminProductsQuery({ category: 'laptop', page: 1 }, 20)).toBe(
      'category=laptop&limit=20',
    );
    expect(
      adminProductsQuery(
        { category: 'gpu', status: 'INACTIVE', q: 'rtx', cursor: 'c', page: 2 },
        20,
      ),
    ).toBe('category=gpu&limit=20&status=INACTIVE&q=rtx&cursor=c');
  });
});
