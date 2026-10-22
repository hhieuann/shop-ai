import { describe, expect, it, vi } from 'vitest';
import { sampleProduct } from '../../../../test/helpers/catalog.js';
import { ProductNotFoundError } from '../domain/errors.js';
import { getProduct } from './getProduct.js';

const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';

describe('getProduct', () => {
  it('getProduct_returnsProduct_whenProductIsActive', async () => {
    // Arrange
    const products = { findById: vi.fn().mockResolvedValue(sampleProduct()) };

    // Act
    const result = await getProduct({ products }, { productId: PRODUCT_ID });

    // Assert
    expect(result).toMatchObject({ productId: PRODUCT_ID, price: 15_990_000, stock: 3 });

    // Verify
    expect(products.findById).toHaveBeenCalledTimes(1);
    expect(products.findById).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('getProduct_throwsProductNotFound_whenProductMissing', async () => {
    // Arrange
    const products = { findById: vi.fn().mockResolvedValue(null) };

    // Act
    const act = getProduct({ products }, { productId: PRODUCT_ID });

    // Assert
    await expect(act).rejects.toBeInstanceOf(ProductNotFoundError);

    // Verify
    expect(products.findById).toHaveBeenCalledTimes(1);
  });

  it('getProduct_throwsProductNotFound_whenProductIsInactive', async () => {
    // Arrange: BR-04, sản phẩm đã ẩn trả 404 như không có
    const products = {
      findById: vi.fn().mockResolvedValue(sampleProduct({ status: 'INACTIVE' })),
    };

    // Act
    const act = getProduct({ products }, { productId: PRODUCT_ID });

    // Assert
    await expect(act).rejects.toBeInstanceOf(ProductNotFoundError);

    // Verify
    expect(products.findById).toHaveBeenCalledTimes(1);
  });
});
