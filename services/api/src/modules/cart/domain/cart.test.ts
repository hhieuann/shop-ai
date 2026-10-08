import { describe, expect, it } from 'vitest';
import {
  addItem,
  isOrderable,
  lineLimit,
  MAX_LINES,
  REMOVED_PRODUCT_NAME,
  removeItem,
  toCartView,
  updateItem,
  type CartLine,
  type ProductSnapshot,
} from './cart.js';
import {
  CartFullError,
  CartItemNotFoundError,
  ProductNotFoundError,
  ProductUnavailableError,
  QuantityLimitError,
} from './errors.js';

const NOW = '2026-10-13T03:00:00.000Z';
const EARLIER = '2026-10-10T03:00:00.000Z';

function product(overrides: Partial<ProductSnapshot> = {}): ProductSnapshot {
  return {
    productId: 'gpu-1',
    name: 'ASUS TUF RTX 4070',
    imageUrl: 'https://example.com/gpu-1.png',
    price: 15_900_000,
    stock: 10,
    status: 'ACTIVE',
    ...overrides,
  };
}

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'gpu-1',
    quantity: 1,
    addedPrice: 15_900_000,
    addedAt: EARLIER,
    ...overrides,
  };
}

/** Bắt lỗi ném ra để kiểm cả loại lỗi lẫn dữ liệu đi kèm */
function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Không có lỗi nào được ném ra');
}

describe('lineLimit', () => {
  it.each([
    { name: 'lineLimit_returnsStock_whenStockBelow99', stock: 10, limit: 10 },
    { name: 'lineLimit_returns99_whenStockAbove99', stock: 500, limit: 99 },
    { name: 'lineLimit_returnsZero_whenStockNegative', stock: -3, limit: 0 },
  ])('$name', ({ stock, limit }) => {
    // Act + Assert
    expect(lineLimit(stock)).toBe(limit);
  });
});

describe('isOrderable', () => {
  it.each([
    {
      name: 'isOrderable_true_whenActiveAndEnoughStock',
      status: 'ACTIVE',
      stock: 3,
      quantity: 3,
      ok: true,
    },
    {
      name: 'isOrderable_false_whenOutOfStock',
      status: 'ACTIVE',
      stock: 0,
      quantity: 1,
      ok: false,
    },
    {
      name: 'isOrderable_false_whenStockBelowQuantity',
      status: 'ACTIVE',
      stock: 1,
      quantity: 3,
      ok: false,
    },
    {
      name: 'isOrderable_false_whenInactive',
      status: 'INACTIVE',
      stock: 10,
      quantity: 1,
      ok: false,
    },
  ] as const)('$name', ({ status, stock, quantity, ok }) => {
    // Act + Assert
    expect(isOrderable({ status, stock, quantity })).toBe(ok);
  });
});

describe('addItem', () => {
  it('addItem_addsNewLine_whenProductNotInCart', () => {
    // Act
    const result = addItem([], product(), 'gpu-1', 2, NOW);

    // Assert
    expect(result).toEqual([
      { productId: 'gpu-1', quantity: 2, addedPrice: 15_900_000, addedAt: NOW },
    ]);
  });

  it('addItem_sumsQuantityAndKeepsAddedAt_whenProductAlreadyInCart', () => {
    // Arrange: BR-04, tiêu chí "quantity 1 + 3 = 4"
    const lines = [line({ quantity: 1 })];

    // Act
    const result = addItem(lines, product(), 'gpu-1', 3, NOW);

    // Assert
    expect(result).toEqual([line({ quantity: 4, addedAt: EARLIER })]);
  });

  it('addItem_updatesAddedPrice_whenPriceChangedSinceFirstAdd', () => {
    // Arrange: BR-06, thêm lại thì cờ giá đổi mất
    const lines = [line({ addedPrice: 500_000 })];

    // Act
    const result = addItem(lines, product({ price: 600_000 }), 'gpu-1', 1, NOW);

    // Assert
    expect(result[0]?.addedPrice).toBe(600_000);
  });

  it('addItem_throwsQuantityLimitWithMaxAddable_whenSumExceedsStock', () => {
    // Arrange: tiêu chí "giỏ có 8, tồn kho 10, thêm 5 → maxAddable 2"
    const lines = [line({ quantity: 8 })];

    // Act
    const error = catchError(() => addItem(lines, product({ stock: 10 }), 'gpu-1', 5, NOW));

    // Assert
    expect(error).toBeInstanceOf(QuantityLimitError);
    expect(error).toMatchObject({ code: 'QUANTITY_LIMIT', extensions: { maxAddable: 2 } });
  });

  it('addItem_throwsQuantityLimit_whenSumExceeds99', () => {
    // Arrange
    const lines = [line({ quantity: 98 })];

    // Act
    const error = catchError(() => addItem(lines, product({ stock: 500 }), 'gpu-1', 2, NOW));

    // Assert
    expect(error).toMatchObject({ code: 'QUANTITY_LIMIT', maxAddable: 1 });
  });

  it('addItem_throwsQuantityLimitWithZero_whenOutOfStock', () => {
    // Act
    const error = catchError(() => addItem([], product({ stock: 0 }), 'gpu-1', 1, NOW));

    // Assert
    expect(error).toMatchObject({ code: 'QUANTITY_LIMIT', maxAddable: 0 });
  });

  it('addItem_throwsProductUnavailable_whenInactive', () => {
    // Act
    const error = catchError(() => addItem([], product({ status: 'INACTIVE' }), 'gpu-1', 1, NOW));

    // Assert
    expect(error).toBeInstanceOf(ProductUnavailableError);
    expect(error).toMatchObject({ code: 'PRODUCT_UNAVAILABLE' });
  });

  it('addItem_throwsProductNotFound_whenProductMissing', () => {
    // Act
    const error = catchError(() => addItem([], null, 'khong-co', 1, NOW));

    // Assert
    expect(error).toBeInstanceOf(ProductNotFoundError);
  });

  it('addItem_throwsCartFull_whenAddingNewLineTo50LineCart', () => {
    // Arrange
    const lines = Array.from({ length: MAX_LINES }, (_, i) => line({ productId: `p-${i}` }));

    // Act
    const error = catchError(() => addItem(lines, product(), 'gpu-1', 1, NOW));

    // Assert
    expect(error).toBeInstanceOf(CartFullError);
    expect(error).toMatchObject({ code: 'CART_FULL' });
  });

  it('addItem_sumsQuantity_whenCartFullButProductAlreadyInCart', () => {
    // Arrange: giỏ đủ 50 dòng nhưng cộng dồn không tạo dòng mới
    const lines = Array.from({ length: MAX_LINES }, (_, i) =>
      line({ productId: i === 0 ? 'gpu-1' : `p-${i}` }),
    );

    // Act
    const result = addItem(lines, product(), 'gpu-1', 1, NOW);

    // Assert
    expect(result).toHaveLength(MAX_LINES);
    expect(result[0]?.quantity).toBe(2);
  });
});

describe('updateItem', () => {
  it('updateItem_setsQuantityAndAddedPrice_whenWithinLimit', () => {
    // Arrange: tiêu chí "PUT quantity 5"; BR-06 sửa số lượng thì cờ giá đổi mất
    const lines = [line({ quantity: 1, addedPrice: 500_000 })];

    // Act
    const result = updateItem(lines, product({ price: 600_000 }), 'gpu-1', 5);

    // Assert
    expect(result).toEqual([line({ quantity: 5, addedPrice: 600_000 })]);
  });

  it('updateItem_throwsQuantityLimitWithLimit_whenAboveStock', () => {
    // Act
    const error = catchError(() => updateItem([line()], product({ stock: 3 }), 'gpu-1', 4));

    // Assert
    expect(error).toMatchObject({ code: 'QUANTITY_LIMIT', maxAddable: 3 });
  });

  it('updateItem_allowsLowering_whenProductInactive', () => {
    // Arrange: BR-07, món ngừng bán vẫn giảm được (để khách tự dọn giỏ)
    const lines = [line({ quantity: 3 })];

    // Act
    const result = updateItem(lines, product({ status: 'INACTIVE', stock: 5 }), 'gpu-1', 1);

    // Assert
    expect(result[0]?.quantity).toBe(1);
  });

  it('updateItem_throwsQuantityLimitZero_whenProductRemovedFromCatalog', () => {
    // Act
    const error = catchError(() => updateItem([line()], null, 'gpu-1', 2));

    // Assert
    expect(error).toMatchObject({ code: 'QUANTITY_LIMIT', maxAddable: 0 });
  });

  it('updateItem_throwsCartItemNotFound_whenLineMissing', () => {
    // Act
    const error = catchError(() => updateItem([], product(), 'gpu-1', 2));

    // Assert
    expect(error).toBeInstanceOf(CartItemNotFoundError);
  });
});

describe('removeItem', () => {
  it('removeItem_removesOnlyThatLine', () => {
    // Arrange
    const lines = [line(), line({ productId: 'ram-1' })];

    // Act
    const result = removeItem(lines, 'gpu-1');

    // Assert
    expect(result).toEqual([line({ productId: 'ram-1' })]);
  });

  it('removeItem_throwsCartItemNotFound_whenLineMissing', () => {
    // Act
    const error = catchError(() => removeItem([line()], 'ram-1'));

    // Assert
    expect(error).toBeInstanceOf(CartItemNotFoundError);
  });
});

describe('toCartView', () => {
  it('toCartView_returnsEmptyCart_whenNoLines', () => {
    // Act + Assert: tiêu chí "giỏ rỗng → items [], totalAmount 0"
    expect(toCartView([], new Map())).toEqual({ items: [], totalAmount: 0 });
  });

  it('toCartView_usesCurrentPriceAndFlagsChange_whenPriceChanged', () => {
    // Arrange: tiêu chí "giá đổi 500.000 → 600.000"
    const products = new Map([['gpu-1', product({ price: 600_000 })]]);

    // Act
    const view = toCartView([line({ addedPrice: 500_000, quantity: 2 })], products);

    // Assert
    expect(view.items[0]).toMatchObject({ price: 600_000, priceChanged: true });
    expect(view.totalAmount).toBe(1_200_000);
  });

  it('toCartView_excludesUnorderableItemsFromTotal', () => {
    // Arrange: tiêu chí "quantity 3 mà tồn kho còn 1 → không tính vào totalAmount"
    const products = new Map<string, ProductSnapshot>([
      ['gpu-1', product({ price: 100, stock: 1 })],
      ['ram-1', product({ productId: 'ram-1', price: 10, stock: 5 })],
      ['psu-1', product({ productId: 'psu-1', price: 1_000, status: 'INACTIVE' })],
    ]);
    const lines = [
      line({ productId: 'gpu-1', quantity: 3, addedPrice: 100 }),
      line({ productId: 'ram-1', quantity: 2, addedPrice: 10 }),
      line({ productId: 'psu-1', quantity: 1, addedPrice: 1_000 }),
    ];

    // Act
    const view = toCartView(lines, products);

    // Assert
    expect(view.items).toHaveLength(3);
    expect(view.totalAmount).toBe(20);
  });

  it('toCartView_showsRemovedProductAsInactive_whenMissingFromCatalog', () => {
    // Act
    const view = toCartView([line({ addedPrice: 700_000, quantity: 2 })], new Map());

    // Assert
    expect(view).toEqual({
      items: [
        {
          productId: 'gpu-1',
          name: REMOVED_PRODUCT_NAME,
          price: 700_000,
          quantity: 2,
          stock: 0,
          status: 'INACTIVE',
          priceChanged: false,
        },
      ],
      totalAmount: 0,
    });
  });

  it('toCartView_omitsImageUrl_whenProductHasNone', () => {
    // Arrange
    const products = new Map([['gpu-1', product({ imageUrl: undefined })]]);

    // Act
    const view = toCartView([line()], products);

    // Assert
    expect(view.items[0]).not.toHaveProperty('imageUrl');
  });
});
