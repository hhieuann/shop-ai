import { describe, expect, it } from 'vitest';
import { OutOfStockError, PriceChangedError } from './errors.js';
import {
  buildOrder,
  canCancel,
  checkItems,
  isOpen,
  toSummary,
  type ProductSnapshot,
  type RequestedItem,
  type ShippingAddress,
} from './order.js';

const NOW = '2026-10-24T03:00:00.000Z';

const ADDRESS: ShippingAddress = {
  fullName: 'Nguyễn Văn A',
  phone: '0912345678',
  address: '12 Nguyễn Huệ, phường Bến Nghé',
  province: 'TP. Hồ Chí Minh',
};

function product(overrides: Partial<ProductSnapshot> = {}): ProductSnapshot {
  return {
    productId: 'gpu-1',
    name: 'ASUS TUF RTX 4070',
    price: 15_900_000,
    stock: 10,
    status: 'ACTIVE',
    ...overrides,
  };
}

function catalog(...products: ProductSnapshot[]): Map<string, ProductSnapshot> {
  return new Map(products.map((p) => [p.productId, p]));
}

function requested(overrides: Partial<RequestedItem> = {}): RequestedItem {
  return { productId: 'gpu-1', quantity: 1, expectedPrice: 15_900_000, ...overrides };
}

/** Bắt lỗi ném ra để kiểm cả loại lỗi lẫn dữ liệu đi kèm */
function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Không ném lỗi');
}

describe('checkItems', () => {
  it('checkItems_passes_whenAllItemsAvailableAtExpectedPrice', () => {
    // Arrange
    const products = catalog(product({ stock: 2 }));

    // Act
    const act = () => checkItems([requested({ quantity: 2 })], products);

    // Assert
    expect(act).not.toThrow();
  });

  it('checkItems_throwsOutOfStockWithAvailable_whenStockLowerThanQuantity', () => {
    // Arrange
    const products = catalog(product({ stock: 2 }));

    // Act
    const error = catchError(() => checkItems([requested({ quantity: 5 })], products));

    // Assert
    expect(error).toBeInstanceOf(OutOfStockError);
    expect((error as OutOfStockError).invalidItems).toEqual([{ productId: 'gpu-1', available: 2 }]);
    expect((error as OutOfStockError).code).toBe('OUT_OF_STOCK');
  });

  it('checkItems_throwsOutOfStockWithZero_whenInactiveOrMissing', () => {
    // Arrange
    const products = catalog(product({ status: 'INACTIVE' }));

    // Act
    const error = catchError(() =>
      checkItems([requested(), requested({ productId: 'khong-con' })], products),
    );

    // Assert
    expect((error as OutOfStockError).invalidItems).toEqual([
      { productId: 'gpu-1', available: 0 },
      { productId: 'khong-con', available: 0 },
    ]);
  });

  it('checkItems_throwsPriceChangedWithCurrentPrice_whenPriceDiffers', () => {
    // Arrange
    const products = catalog(product({ price: 600_000 }));

    // Act
    const error = catchError(() => checkItems([requested({ expectedPrice: 500_000 })], products));

    // Assert
    expect(error).toBeInstanceOf(PriceChangedError);
    expect((error as PriceChangedError).changedItems).toEqual([
      { productId: 'gpu-1', expectedPrice: 500_000, currentPrice: 600_000 },
    ]);
    expect((error as PriceChangedError).code).toBe('PRICE_CHANGED');
  });

  it('checkItems_throwsOutOfStockFirst_whenOneItemOutAndAnotherPriceChanged', () => {
    // Arrange
    const products = catalog(
      product({ stock: 0 }),
      product({ productId: 'psu-1', price: 2_000_000 }),
    );

    // Act
    const error = catchError(() =>
      checkItems(
        [requested(), requested({ productId: 'psu-1', expectedPrice: 1_800_000 })],
        products,
      ),
    );

    // Assert
    expect(error).toBeInstanceOf(OutOfStockError);
  });
});

describe('buildOrder', () => {
  it('buildOrder_returnsPendingOrderWithSnapshotAndTotal_whenItemsValid', () => {
    // Arrange
    const products = catalog(
      product({ price: 100_000 }),
      product({ productId: 'mouse-1', name: 'Chuột G502', price: 50_000 }),
    );

    // Act
    const order = buildOrder({
      orderId: '01K8ORDER',
      userId: 'user-1',
      requested: [
        requested({ quantity: 2, expectedPrice: 100_000 }),
        requested({ productId: 'mouse-1', quantity: 1, expectedPrice: 50_000 }),
      ],
      products,
      shippingAddress: ADDRESS,
      now: NOW,
    });

    // Assert
    expect(order).toEqual({
      orderId: '01K8ORDER',
      userId: 'user-1',
      status: 'PENDING',
      items: [
        { productId: 'gpu-1', name: 'ASUS TUF RTX 4070', price: 100_000, quantity: 2 },
        { productId: 'mouse-1', name: 'Chuột G502', price: 50_000, quantity: 1 },
      ],
      totalAmount: 250_000,
      shippingFee: 0,
      shippingAddress: ADDRESS,
      paymentMethod: 'COD',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('buildOrder_throwsOutOfStock_whenAnyItemUnavailable', () => {
    // Arrange
    const products = catalog(product({ stock: 0 }));

    // Act
    const error = catchError(() =>
      buildOrder({
        orderId: '01K8ORDER',
        userId: 'user-1',
        requested: [requested()],
        products,
        shippingAddress: ADDRESS,
        now: NOW,
      }),
    );

    // Assert
    expect(error).toBeInstanceOf(OutOfStockError);
  });
});

describe('toSummary', () => {
  it('toSummary_countsLines_notQuantity', () => {
    // Arrange
    const order = buildOrder({
      orderId: '01K8ORDER',
      userId: 'user-1',
      requested: [requested({ quantity: 3 })],
      products: catalog(product()),
      shippingAddress: ADDRESS,
      now: NOW,
    });

    // Act
    const summary = toSummary(order);

    // Assert
    expect(summary).toEqual({
      orderId: '01K8ORDER',
      status: 'PENDING',
      totalAmount: 47_700_000,
      itemCount: 1,
      createdAt: NOW,
    });
  });
});

describe('trạng thái đơn', () => {
  it.each([
    ['PENDING', true],
    ['CONFIRMED', true],
    ['SHIPPED', false],
    ['DELIVERED', false],
    ['CANCELLED', false],
  ] as const)('isOpen_returns_%s_%s', (status, expected) => {
    expect(isOpen(status)).toBe(expected);
  });

  it.each([
    ['PENDING', true, true],
    ['CONFIRMED', true, true],
    ['SHIPPED', false, true],
    ['DELIVERED', false, false],
    ['CANCELLED', false, false],
  ] as const)('canCancel_%s_customer%s_admin%s', (status, customer, admin) => {
    expect(canCancel(status, 'customer')).toBe(customer);
    expect(canCancel(status, 'admin')).toBe(admin);
  });
});
