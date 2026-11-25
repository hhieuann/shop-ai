import { describe, expect, it, vi } from 'vitest';
import { sampleProduct } from '../../../../test/helpers/catalog.js';
import { ProductNotFoundError } from '../domain/errors.js';
import { getAdminProduct } from './getAdminProduct.js';

const PRODUCT_ID = '01K6PZ3Q5G0000000000000001';

describe('getAdminProduct', () => {
  it.each([
    ['đang bán', sampleProduct()],
    ['đã ẩn', sampleProduct({ status: 'INACTIVE' })],
    ['đã xoá mềm', sampleProduct({ status: 'INACTIVE', deletedAt: '2026-11-25T08:00:00.000Z' })],
  ])('getAdminProduct_returnsProduct_when_%s', async (_name, product) => {
    // Arrange
    const products = { findById: vi.fn().mockResolvedValue(product) };

    // Act
    const result = await getAdminProduct({ products }, { productId: PRODUCT_ID });

    // Assert
    expect(result).toEqual(product);
    // Verify
    expect(products.findById).toHaveBeenCalledTimes(1);
    expect(products.findById).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('getAdminProduct_throwsProductNotFound_whenMissing', async () => {
    // Arrange
    const products = { findById: vi.fn().mockResolvedValue(null) };

    // Act
    const act = getAdminProduct({ products }, { productId: PRODUCT_ID });

    // Assert
    await expect(act).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
