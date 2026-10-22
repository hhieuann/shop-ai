import { afterEach, describe, expect, it, vi } from 'vitest';
import { requiredEnv } from './config.js';

describe('requiredEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requiredEnv_returnsValue_whenVariableIsSet', () => {
    // Arrange
    vi.stubEnv('PRODUCTS_TABLE', 'shop-sbx-an-products');

    // Act
    const value = requiredEnv('PRODUCTS_TABLE');

    // Assert
    expect(value).toBe('shop-sbx-an-products');
  });

  it('requiredEnv_throwsNamingTheVariable_whenVariableIsEmpty', () => {
    // Arrange
    vi.stubEnv('PRODUCTS_TABLE', '');

    // Act
    const act = () => requiredEnv('PRODUCTS_TABLE');

    // Assert
    expect(act).toThrow('PRODUCTS_TABLE');
  });
});
