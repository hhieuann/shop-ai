/**
 * Số cột của lưới ô thông số (design-system §9.24): nhiều cột nhất sao cho mỗi ô rộng ít nhất
 * `minTile`, rồi cân lại để các hàng gần bằng nhau (hàng trên đầy rồi mới xuống hàng).
 * Chưa đo được bề rộng (render lần đầu, môi trường test) thì tối đa 2 cột.
 */
export function balancedColumns(
  count: number,
  width: number,
  minTile: number,
  gap: number,
): number {
  if (count <= 0) return 0;
  if (width <= 0) return Math.min(2, count);
  const maxCols = Math.max(1, Math.floor((width + gap) / (minTile + gap)));
  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / cols);
  return Math.ceil(count / rows);
}
