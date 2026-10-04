import { describe, expect, it } from 'vitest';
import { isVisibleToCustomers } from './product.js';

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
