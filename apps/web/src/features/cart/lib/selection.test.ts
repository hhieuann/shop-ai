import { describe, it, expect } from 'vitest';
import {
  getSelectedItems,
  toggleAll,
  toggleOne,
  unavailableReason,
  type SelectableItem,
} from './selection';

const gpu: SelectableItem = { productId: 'gpu', status: 'ACTIVE', stock: 3, quantity: 1 };
const mouse: SelectableItem = { productId: 'mouse', status: 'ACTIVE', stock: 5, quantity: 2 };
const ram: SelectableItem = { productId: 'ram', status: 'ACTIVE', stock: 0, quantity: 1 };
const old: SelectableItem = { productId: 'old', status: 'INACTIVE', stock: 9, quantity: 1 };
const ssd: SelectableItem = { productId: 'ssd', status: 'ACTIVE', stock: 2, quantity: 5 };

describe('unavailableReason', () => {
  it('unavailableReason_returnsOnlyLeft_whenStockLowerThanQuantity', () => {
    // Arrange: kho còn 2, giỏ có 5 (lỗi cũ: chỉ kiểm stock > 0 nên vẫn cho đặt)
    const item = ssd;

    // Act
    const reason = unavailableReason(item);

    // Assert
    expect(reason).toBe('Chỉ còn 2 sản phẩm');
  });

  it('unavailableReason_returnsNull_whenStockEnough', () => {
    // Arrange: kho còn 5, giỏ có 2
    const item = mouse;

    // Act
    const reason = unavailableReason(item);

    // Assert
    expect(reason).toBeNull();
  });

  it('unavailableReason_prefersInactive_whenProductStoppedSelling', () => {
    // Arrange: ngừng bán dù kho còn 9
    const item = old;

    // Act
    const reason = unavailableReason(item);

    // Assert
    expect(reason).toBe('Ngừng bán');
  });

  it('unavailableReason_returnsOutOfStock_whenStockIsZero', () => {
    // Arrange
    const item = ram;

    // Act
    const reason = unavailableReason(item);

    // Assert
    expect(reason).toBe('Hết hàng');
  });
});

describe('cart selection', () => {
  it('getSelectedItems_selectsAllValidItems_whenNothingDeselected', () => {
    // Arrange
    const items = [gpu, mouse, ram, old, ssd];

    // Act
    const result = getSelectedItems(items, new Set());

    // Assert
    expect(result.map((i) => i.productId)).toEqual(['gpu', 'mouse']);
  });

  it('getSelectedItems_keepsUserChoice_whenAnotherItemIsRemoved', () => {
    // Arrange: khách bỏ chọn mouse, sau đó xoá gpu khỏi giỏ
    const deselected = toggleOne(new Set(), 'mouse');
    const itemsAfterRemove = [mouse, ram];

    // Act
    const result = getSelectedItems(itemsAfterRemove, deselected);

    // Assert: không tự chọn lại mouse (lỗi của bản cũ)
    expect(result).toEqual([]);
  });

  it('toggleAll_deselectsEverything_whenAllAreSelected', () => {
    // Arrange
    const items = [gpu, mouse, ram];

    // Act
    const deselected = toggleAll(items, new Set());

    // Assert
    expect(getSelectedItems(items, deselected)).toEqual([]);
  });

  it('toggleAll_selectsEverything_whenSomeAreDeselected', () => {
    // Arrange
    const items = [gpu, mouse];
    const deselected = new Set(['gpu']);

    // Act
    const next = toggleAll(items, deselected);

    // Assert
    expect(getSelectedItems(items, next)).toEqual([gpu, mouse]);
  });
});
