import { describe, it, expect } from 'vitest';
import type { CartItem, MergeCartResult } from '../../../shared/api/types';
import { decideAfterMerge, type CheckoutIntent } from './afterSignIn';

const item = (productId: string, quantity: number, stock = 10): CartItem => ({
  productId,
  name: productId,
  price: 1000,
  quantity,
  stock,
  status: 'ACTIVE',
});
const merged = (
  items: CartItem[],
  extra: Partial<Pick<MergeCartResult, 'mergedExisting' | 'adjustments'>> = {},
): MergeCartResult => ({
  cart: { items, totalAmount: 0 },
  mergedExisting: extra.mergedExisting ?? [],
  adjustments: extra.adjustments ?? [],
});
const intent: CheckoutIntent = {
  items: [
    { productId: 'gpu', quantity: 1 },
    { productId: 'psu', quantity: 2 },
  ],
};

describe('decideAfterMerge', () => {
  it('decideAfterMerge_goesToCheckoutWithTickedItems_whenMergedExactly', () => {
    // BR-11: giỏ tài khoản chưa có món nào trùng → sang thẳng checkout
    const result = merged([item('gpu', 1), item('psu', 2), item('ram', 1)]);
    expect(decideAfterMerge(intent, result)).toEqual({
      to: 'checkout',
      selectedItems: [item('gpu', 1), item('psu', 2)],
    });
  });

  it('decideAfterMerge_goesToCart_whenTickedItemWasAlreadyInAccountCart', () => {
    // Giỏ tài khoản đã có psu → cộng dồn thành 3, khác số khách vừa chọn
    const result = merged([item('gpu', 1), item('psu', 3)], { mergedExisting: ['psu'] });
    expect(decideAfterMerge(intent, result)).toEqual({ to: 'cart' });
  });

  it('decideAfterMerge_goesToCart_whenTickedItemWasAdjusted', () => {
    const result = merged([item('gpu', 1), item('psu', 1)], {
      adjustments: [{ productId: 'psu', reason: 'QUANTITY_LIMITED', requested: 2, merged: 1 }],
    });
    expect(decideAfterMerge(intent, result).to).toBe('cart');
  });

  it('decideAfterMerge_goesToCart_whenTickedItemCannotBeOrderedAnymore', () => {
    // Tồn kho tụt giữa lúc tick và lúc đăng nhập
    const result = merged([item('gpu', 1), item('psu', 2, 1)]);
    expect(decideAfterMerge(intent, result).to).toBe('cart');
  });

  it('decideAfterMerge_ignoresChangesToUntickedItems', () => {
    const result = merged([item('gpu', 1), item('psu', 2), item('ram', 5)], {
      mergedExisting: ['ram'],
    });
    expect(decideAfterMerge(intent, result).to).toBe('checkout');
  });

  it('decideAfterMerge_staysOnCurrentPage_whenSignedInWithoutCheckoutIntent', () => {
    // Đăng nhập bằng nút "Tài khoản": gộp xong ở lại trang đang xem
    const result = merged([item('gpu', 3)], { mergedExisting: ['gpu'] });
    expect(decideAfterMerge(null, result)).toEqual({ to: 'from' });
  });
});
