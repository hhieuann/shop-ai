import { describe, it, expect } from 'vitest';
import { formatDateTime, formatVnd, spokenVnd } from './format';

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

describe('formatDateTime', () => {
  it('formatDateTime_showsVietnamTime_dayMonthYearHourMinute', () => {
    // Act, Assert: 06:42 UTC là 13:42 giờ Việt Nam
    expect(formatDateTime('2026-11-06T06:42:00.000Z')).toBe('06/11/2026 13:42');
  });

  it('formatDateTime_midnightIs00_notTwentyFour_andMovesToNextDay', () => {
    // Act, Assert: 17:05 UTC là 00:05 ngày hôm sau giờ Việt Nam (không in 24:05)
    expect(formatDateTime('2026-11-06T17:05:00Z')).toBe('07/11/2026 00:05');
  });
});
