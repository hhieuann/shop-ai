import { describe, it, expect } from 'vitest';
import { formatVnd, spokenVnd } from './format';

describe('formatVnd', () => {
  it('formatVnd_usesDotSeparatorAndDongSign_whenAmountHasThousands', () => {
    // Arrange
    const amount = 24_990_000;

    // Act
    const text = formatVnd(amount);

    // Assert: đúng định dạng giá: dấu chấm ngăn nghìn, ₫ sau số
    expect(text).toBe('24.990.000₫');
  });

  it('spokenVnd_readsFullWord_forScreenReaders', () => {
    // Act
    const text = spokenVnd(650_000);

    // Assert
    expect(text).toBe('650.000 đồng');
  });
});
