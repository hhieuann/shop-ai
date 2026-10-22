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
  it('toSummary_keepsListFieldsWithSpecs', () => {
    // Arrange
    const product = sampleProduct();

    // Act
    const result = toSummary(product);

    // Assert: khớp ProductSummary trong OpenAPI, có specs, bỏ mô tả và thời gian
    expect(result).toEqual({
      productId: product.productId,
      name: product.name,
      category: 'gpu',
      brand: 'ASUS',
      price: 15_990_000,
      stock: 3,
      status: 'ACTIVE',
      imageUrl: product.imageUrl,
      specs: { vram: '12GB GDDR6X', tdp: '200W' },
    });
  });

  it('toSummary_omitsOptionalKeys_whenProductHasNoImageOrSpecs', () => {
    // Arrange
    const product = sampleProduct({ imageUrl: undefined, specs: undefined });

    // Act
    const result = toSummary(product);

    // Assert: không có khoá, kể cả với giá trị undefined (JSON gọn, khớp OpenAPI)
    expect(Object.keys(result)).not.toContain('imageUrl');
    expect(Object.keys(result)).not.toContain('specs');
  });

  it('toSummary_doesNotLeakInternalFields', () => {
    // Arrange: sản phẩm trong bộ nhớ Lambda có thêm tên đã chuẩn hoá để tìm kiếm
    const product = { ...sampleProduct(), searchText: 'asus tuf gaming geforce rtx 4070 12gb' };

    // Act
    const result = toSummary(product);

    // Assert
    expect(result).not.toHaveProperty('searchText');
    expect(result).not.toHaveProperty('description');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });
});
