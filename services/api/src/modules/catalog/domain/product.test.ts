import { describe, expect, it } from 'vitest';
import { availabilityOf, LOW_STOCK_THRESHOLD } from './product.js';

describe('availabilityOf', () => {
  it('availabilityOf_returnsOutOfStock_whenStockIsZero', () => {
    // Arrange
    const product = { stock: 0 };

    // Act
    const result = availabilityOf(product);

    // Assert
    expect(result).toBe('OUT_OF_STOCK');
  });

  it('availabilityOf_returnsLowStock_whenStockEqualsThreshold', () => {
    // Arrange
    const product = { stock: LOW_STOCK_THRESHOLD };

    // Act
    const result = availabilityOf(product);

    // Assert
    expect(result).toBe('LOW_STOCK');
  });

  it('availabilityOf_returnsInStock_whenStockAboveThreshold', () => {
    // Arrange
    const product = { stock: LOW_STOCK_THRESHOLD + 1 };

    // Act
    const result = availabilityOf(product);

    // Assert
    expect(result).toBe('IN_STOCK');
  });
});
