import { describe, expect, it } from 'vitest';
import { pickRecommendations, type RecProduct } from './recs.js';

function product(productId: string, overrides: Partial<RecProduct> = {}): RecProduct {
  return {
    productId,
    name: `Sản phẩm ${productId}`,
    category: 'gpu',
    brand: 'ASUS',
    price: 1_000_000,
    stock: 5,
    status: 'ACTIVE',
    ...overrides,
  };
}

function catalog(...products: RecProduct[]): Map<string, RecProduct> {
  return new Map(products.map((p) => [p.productId, p]));
}

describe('pickRecommendations', () => {
  it('keepsPipelineRank_andStopsAtLimit', () => {
    // Arrange
    const products = catalog(product('a'), product('b'), product('c'));

    // Act
    const picked = pickRecommendations(['c', 'a', 'b'], products, new Set(), 2);

    // Assert
    expect(picked.map((p) => p.productId)).toEqual(['c', 'a']);
  });

  it('skipsOutOfStockInactiveAndUnknownProducts', () => {
    // Arrange
    const products = catalog(
      product('out', { stock: 0 }),
      product('off', { status: 'INACTIVE' }),
      product('ok'),
    );

    // Act
    const picked = pickRecommendations(['out', 'off', 'gone', 'ok'], products, new Set(), 10);

    // Assert
    expect(picked.map((p) => p.productId)).toEqual(['ok']);
  });

  it('skipsExcludedAndDuplicateIds', () => {
    // Arrange: `exclude` là hàng đã trong giỏ
    const products = catalog(product('a'), product('b'), product('c'));

    // Act
    const picked = pickRecommendations(['a', 'b', 'a', 'c'], products, new Set(['b']), 10);

    // Assert
    expect(picked.map((p) => p.productId)).toEqual(['a', 'c']);
  });

  it('fillsLimitFromLowerRanks_whenTopRanksAreFiltered', () => {
    // Arrange: lý do pipeline ghi 20 dòng mỗi anchor
    const products = catalog(product('a', { stock: 0 }), product('b'), product('c'));

    // Act
    const picked = pickRecommendations(['a', 'b', 'c'], products, new Set(), 2);

    // Assert
    expect(picked.map((p) => p.productId)).toEqual(['b', 'c']);
  });
});
