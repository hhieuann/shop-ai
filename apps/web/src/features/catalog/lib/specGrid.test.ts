import { describe, expect, it } from 'vitest';
import { balancedColumns } from './specGrid';

const GAP = 8;

describe('balancedColumns', () => {
  // Số đo theo pages/chi-tiet-san-pham.md §3.5: ô tối thiểu 220px (<640: 150px), cách 8px
  it.each([
    { count: 5, width: 1360, minTile: 220, cols: 5 }, // 1920: 1 hàng 5 ô
    { count: 5, width: 810, minTile: 220, cols: 3 }, // 1366: 3 + 2
    { count: 4, width: 810, minTile: 220, cols: 2 }, // 1366: 2 + 2, không để 3 + 1
    { count: 5, width: 358, minTile: 150, cols: 2 }, // 390: 2 + 2 + 1
    { count: 2, width: 1360, minTile: 220, cols: 2 },
    { count: 1, width: 100, minTile: 220, cols: 1 }, // hẹp hơn một ô vẫn 1 cột
  ])(
    '$count ô, rộng $width (tối thiểu $minTile) → $cols cột',
    ({ count, width, minTile, cols }) => {
      expect(balancedColumns(count, width, minTile, GAP)).toBe(cols);
    },
  );

  it('không có ô nào thì 0 cột', () => {
    expect(balancedColumns(0, 1360, 220, GAP)).toBe(0);
  });

  it('chưa đo được bề rộng thì tối đa 2 cột', () => {
    expect(balancedColumns(5, 0, 220, GAP)).toBe(2);
    expect(balancedColumns(1, 0, 220, GAP)).toBe(1);
  });
});
