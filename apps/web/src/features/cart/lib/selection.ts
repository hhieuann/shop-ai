/**
 * Luật tick chọn trong giỏ, viết thành hàm thuần để test được mà không cần React.
 *
 * Ý tưởng: lưu những món khách đã BỎ chọn thay vì những món được chọn.
 * - Mặc định (deselected rỗng) = chọn tất cả món hợp lệ → không cần effect để "tự chọn khi load xong"
 * - Món mới thêm vào giỏ tự được chọn
 * - Món bị xoá khỏi giỏ tự biến mất khỏi kết quả vì ta luôn lọc theo items hiện tại
 */
export interface SelectableItem {
  productId: string;
  status: 'ACTIVE' | 'INACTIVE';
  stock: number;
  quantity: number;
}

/**
 * Lý do món không đặt được (cart.md BR-07), hoặc null nếu đặt được.
 * Thứ tự kiểm: ngừng bán → hết hàng → không đủ số lượng.
 */
export function unavailableReason(item: SelectableItem): string | null {
  if (item.status !== 'ACTIVE') return 'Ngừng bán';
  if (item.stock <= 0) return 'Hết hàng';
  if (item.stock < item.quantity) return `Chỉ còn ${item.stock} sản phẩm`;
  return null;
}

/** cart.md BR-07, ordering.md BR-03: chỉ đặt được món ACTIVE có stock >= quantity */
export function canSelect(item: SelectableItem): boolean {
  return unavailableReason(item) === null;
}

export function getSelectedItems<T extends SelectableItem>(
  items: readonly T[],
  deselected: ReadonlySet<string>,
): T[] {
  return items.filter((i) => canSelect(i) && !deselected.has(i.productId));
}

/** Đảo trạng thái một món; trả về Set mới để React nhận ra state đã đổi */
export function toggleOne(deselected: ReadonlySet<string>, productId: string): Set<string> {
  const next = new Set(deselected);
  if (next.has(productId)) next.delete(productId);
  else next.add(productId);
  return next;
}

/** Nút "Chọn tất cả": đang chọn hết thì bỏ hết, ngược lại chọn hết */
export function toggleAll(
  items: readonly SelectableItem[],
  deselected: ReadonlySet<string>,
): Set<string> {
  const selectable = items.filter(canSelect);
  const allSelected = selectable.every((i) => !deselected.has(i.productId));
  return allSelected ? new Set(selectable.map((i) => i.productId)) : new Set();
}
