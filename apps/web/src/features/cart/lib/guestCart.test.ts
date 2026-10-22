import { describe, it, expect } from 'vitest';
import {
  addLine,
  parseGuestCart,
  removeLine,
  setLineQuantity,
  type GuestLine,
  type ProductFacts,
} from './guestCart';

const gpu: ProductFacts = { price: 15_900_000, stock: 10, status: 'ACTIVE' };
const line = (productId: string, quantity: number, addedPrice = 100): GuestLine => ({
  productId,
  quantity,
  addedPrice,
});

describe('addLine', () => {
  it('addLine_addsNewLine_withCurrentPriceAsAddedPrice', () => {
    const result = addLine([], 'gpu', 2, gpu);
    expect(result).toEqual({ ok: true, lines: [line('gpu', 2, 15_900_000)] });
  });

  it('addLine_accumulatesQuantity_whenProductAlreadyInCart', () => {
    // BR-04: thêm lại món đã có thì cộng dồn, không tạo dòng mới
    const result = addLine([line('gpu', 1)], 'gpu', 3, gpu);
    expect(result).toEqual({ ok: true, lines: [line('gpu', 4, 15_900_000)] });
  });

  it('addLine_returnsQuantityLimitWithMaxAddable_whenOverStock', () => {
    // BR-03, BR-04: giỏ có 8, kho 10, thêm 5 → chỉ thêm được 2, giỏ giữ nguyên
    const result = addLine([line('gpu', 8)], 'gpu', 5, gpu);
    expect(result).toEqual({ ok: false, error: { code: 'QUANTITY_LIMIT', maxAddable: 2 } });
  });

  it('addLine_capsAt99_evenWhenStockIsHigher', () => {
    const result = addLine([line('gpu', 98)], 'gpu', 2, { ...gpu, stock: 500 });
    expect(result).toEqual({ ok: false, error: { code: 'QUANTITY_LIMIT', maxAddable: 1 } });
  });

  it('addLine_returnsCartFull_whenAdding51stLine', () => {
    const full = Array.from({ length: 50 }, (_, i) => line(`p${i}`, 1));
    expect(addLine(full, 'gpu', 1, gpu)).toEqual({ ok: false, error: { code: 'CART_FULL' } });
  });

  it('addLine_returnsProductUnavailable_whenInactive', () => {
    const result = addLine([], 'gpu', 1, { ...gpu, status: 'INACTIVE' });
    expect(result).toEqual({ ok: false, error: { code: 'PRODUCT_UNAVAILABLE' } });
  });
});

describe('setLineQuantity', () => {
  it('setLineQuantity_updatesQuantityAndAddedPrice_soPriceChangedFlagClears', () => {
    // BR-06: sửa số lượng thì addedPrice lấy giá hiện tại
    const result = setLineQuantity([line('gpu', 1, 100)], 'gpu', 3, gpu);
    expect(result).toEqual({ ok: true, lines: [line('gpu', 3, 15_900_000)] });
  });

  it('setLineQuantity_allowsReducingToStock_whenCartHasMoreThanStock', () => {
    // "Giảm về X": giỏ có 5, kho còn 2
    const result = setLineQuantity([line('gpu', 5)], 'gpu', 2, { ...gpu, stock: 2 });
    expect(result.ok).toBe(true);
  });

  it('setLineQuantity_returnsQuantityLimit_whenOverStock', () => {
    const result = setLineQuantity([line('gpu', 1)], 'gpu', 11, gpu);
    expect(result).toEqual({ ok: false, error: { code: 'QUANTITY_LIMIT', maxAddable: 10 } });
  });
});

describe('removeLine', () => {
  it('removeLine_keepsOtherLines', () => {
    expect(removeLine([line('a', 1), line('b', 2)], 'a')).toEqual([line('b', 2)]);
  });
});

describe('parseGuestCart', () => {
  it('parseGuestCart_returnsEmpty_whenNothingStoredOrNotJson', () => {
    expect(parseGuestCart(null)).toEqual([]);
    expect(parseGuestCart('{oops')).toEqual([]);
    expect(parseGuestCart('{"a":1}')).toEqual([]);
  });

  it('parseGuestCart_dropsBrokenAndDuplicateLines', () => {
    // Giỏ trên trình duyệt có thể bị sửa tay
    const raw = JSON.stringify([
      line('a', 2),
      { productId: 'b', quantity: -1, addedPrice: 100 },
      { productId: 'c', quantity: 1.5, addedPrice: 100 },
      { productId: '', quantity: 1, addedPrice: 100 },
      { productId: 'd', quantity: 1 },
      line('a', 5),
      'rác',
    ]);
    expect(parseGuestCart(raw)).toEqual([line('a', 2)]);
  });

  it('parseGuestCart_capsQuantityAt99_andLinesAt50', () => {
    const raw = JSON.stringify(Array.from({ length: 60 }, (_, i) => line(`p${i}`, 500)));
    const lines = parseGuestCart(raw);
    expect(lines).toHaveLength(50);
    expect(lines[0]?.quantity).toBe(99);
  });
});
