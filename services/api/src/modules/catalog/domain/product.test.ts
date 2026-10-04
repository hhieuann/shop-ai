import { describe, expect, it } from 'vitest';
import { sampleProduct } from '../../../../test/helpers/catalog.js';
import { isInStock, isVisibleToCustomers, toSummary } from './product.js';

describe('isVisibleToCustomers', () => {
  it.each([
    {
      name: 'isVisibleToCustomers_returnsTrue_whenStatusIsActive',
      status: 'ACTIVE' as const,
      visible: true,
    },
    {
      name: 'isVisibleToCustomers_returnsFalse_whenStatusIsInactive',
      status: 'INACTIVE' as const,
      visible: false,
    },
  ])('$name', ({ status, visible }) => {
    // Act
    const result = isVisibleToCustomers({ status });

    // Assert
    expect(result).toBe(visible);
  });
});

describe('isInStock', () => {
  it.each([
    { name: 'isInStock_returnsTrue_whenStockPositive', stock: 1, inStock: true },
    { name: 'isInStock_returnsFalse_whenStockZero', stock: 0, inStock: false },
  ])('$name', ({ stock, inStock }) => {
    // Act
    const result = isInStock({ stock });

    // Assert
    expect(result).toBe(inStock);
  });
});

describe('toSummary', () => {
  it('toSummary_keepsOnlyListFields', () => {
    // Arrange
    const product = sampleProduct();

    // Act
    const result = toSummary(product);

    // Assert: khớp ProductSummary trong OpenAPI, bỏ mô tả, specs, thời gian
    expect(result).toEqual({
      productId: product.productId,
      name: product.name,
      category: 'gpu',
      brand: 'ASUS',
      price: 15_990_000,
      stock: 3,
      status: 'ACTIVE',
      imageUrl: product.imageUrl,
    });
  });
});
