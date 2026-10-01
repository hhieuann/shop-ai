import { describe, expect, it, vi } from 'vitest';
import { ProductNotFoundError } from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import { getProduct } from './getProduct.js';

const rtx4070: Product = {
  id: 'gpu-rtx4070',
  name: 'NVIDIA GeForce RTX 4070 12GB',
  category: 'gpu',
  priceVnd: 15_990_000,
  stock: 3,
  attributes: { vramGb: 12, tdpW: 200 },
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('getProduct', () => {
  it('getProduct_returnsViewWithAvailability_whenProductExists', async () => {
    // Arrange
    const products = { findById: vi.fn().mockResolvedValue(rtx4070) };

    // Act
    const result = await getProduct({ products }, { id: 'gpu-rtx4070' });

    // Assert
    expect(result).toEqual({
      id: 'gpu-rtx4070',
      name: 'NVIDIA GeForce RTX 4070 12GB',
      category: 'gpu',
      priceVnd: 15_990_000,
      availability: 'LOW_STOCK',
      attributes: { vramGb: 12, tdpW: 200 },
    });
    expect(result).not.toHaveProperty('stock');

    // Verify
    expect(products.findById).toHaveBeenCalledTimes(1);
    expect(products.findById).toHaveBeenCalledWith('gpu-rtx4070');
  });

  it('getProduct_throwsProductNotFound_whenProductMissing', async () => {
    // Arrange
    const products = { findById: vi.fn().mockResolvedValue(null) };

    // Act
    const act = getProduct({ products }, { id: 'khong-co' });

    // Assert
    await expect(act).rejects.toBeInstanceOf(ProductNotFoundError);

    // Verify
    expect(products.findById).toHaveBeenCalledTimes(1);
    expect(products.findById).toHaveBeenCalledWith('khong-co');
  });
});
