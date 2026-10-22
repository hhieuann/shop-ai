import { describe, expect, it } from 'vitest';
import type { CartLine, ProductSnapshot } from '../domain/cart.js';
import { CartItemNotFoundError, QuantityLimitError } from '../domain/errors.js';
import {
  CartVersionConflictError,
  type CartRepository,
  type ProductCatalog,
  type StoredCart,
} from '../ports.js';
import {
  addCartItem,
  getCart,
  MAX_ATTEMPTS,
  mergeCart,
  removeCartItem,
  updateCartItem,
  type CartDeps,
} from './cartService.js';

const NOW = '2026-10-13T03:00:00.000Z';

const gpu: ProductSnapshot = {
  productId: 'gpu-1',
  name: 'ASUS TUF RTX 4070',
  price: 15_900_000,
  stock: 10,
  status: 'ACTIVE',
};
const ram: ProductSnapshot = {
  productId: 'ram-1',
  name: 'Corsair DDR5 32GB',
  price: 3_200_000,
  stock: 2,
  status: 'ACTIVE',
};

/** Bảng carts giả trong bộ nhớ, kiểm phiên bản giống ghi có điều kiện thật */
class FakeCarts implements CartRepository {
  readonly saved: { lines: readonly CartLine[]; updatedAt: string }[] = [];
  private versions = 0;
  /** Số lần save đầu tiên giả vờ bị request khác ghi trước */
  conflictsLeft = 0;

  constructor(private stored: StoredCart = { lines: [], version: null }) {}

  async get(): Promise<StoredCart> {
    return this.stored;
  }

  async save(
    userId: string,
    lines: readonly CartLine[],
    expectedVersion: string | null,
    updatedAt: string,
  ): Promise<void> {
    if (this.conflictsLeft > 0 || expectedVersion !== this.stored.version) {
      this.conflictsLeft = Math.max(0, this.conflictsLeft - 1);
      throw new CartVersionConflictError(userId);
    }
    this.stored = { lines, version: `v-new-${++this.versions}` };
    this.saved.push({ lines, updatedAt });
  }
}

class FakeCatalog implements ProductCatalog {
  readonly requests: (readonly string[])[] = [];

  constructor(private readonly products: readonly ProductSnapshot[]) {}

  async findMany(ids: readonly string[]): Promise<Map<string, ProductSnapshot>> {
    this.requests.push(ids);
    return new Map(
      this.products.filter((p) => ids.includes(p.productId)).map((p) => [p.productId, p]),
    );
  }
}

function deps(carts: FakeCarts, catalog = new FakeCatalog([gpu, ram])): CartDeps {
  return { carts, catalog, now: () => NOW };
}

const gpuLine: CartLine = {
  productId: 'gpu-1',
  quantity: 1,
  addedPrice: 15_900_000,
  addedAt: '2026-10-10T00:00:00.000Z',
};

describe('getCart', () => {
  it('getCart_returnsEmptyCart_whenUserHasNoCart', async () => {
    // Arrange
    const catalog = new FakeCatalog([gpu]);

    // Act
    const view = await getCart(deps(new FakeCarts(), catalog), { userId: 'u1' });

    // Assert
    expect(view).toEqual({ items: [], totalAmount: 0 });
  });

  it('getCart_readsAllProductsOnce', async () => {
    // Arrange
    const carts = new FakeCarts({
      lines: [gpuLine, { ...gpuLine, productId: 'ram-1', addedPrice: 3_200_000 }],
      version: 'v1',
    });
    const catalog = new FakeCatalog([gpu, ram]);

    // Act
    const view = await getCart(deps(carts, catalog), { userId: 'u1' });

    // Assert
    expect(catalog.requests).toEqual([['gpu-1', 'ram-1']]);
    expect(view.totalAmount).toBe(15_900_000 + 3_200_000);
  });
});

describe('addCartItem', () => {
  it('addCartItem_savesNewCartAndReturnsView_whenCartEmpty', async () => {
    // Arrange
    const carts = new FakeCarts();

    // Act
    const view = await addCartItem(deps(carts), { userId: 'u1', productId: 'gpu-1', quantity: 2 });

    // Assert
    expect(carts.saved).toEqual([
      {
        lines: [{ productId: 'gpu-1', quantity: 2, addedPrice: 15_900_000, addedAt: NOW }],
        updatedAt: NOW,
      },
    ]);
    expect(view.items[0]).toMatchObject({ productId: 'gpu-1', quantity: 2, priceChanged: false });
    expect(view.totalAmount).toBe(31_800_000);
  });

  it('addCartItem_retriesWithFreshCart_whenAnotherRequestSavedFirst', async () => {
    // Arrange
    const carts = new FakeCarts({ lines: [gpuLine], version: 'v1' });
    carts.conflictsLeft = 1;

    // Act
    const view = await addCartItem(deps(carts), { userId: 'u1', productId: 'gpu-1', quantity: 1 });

    // Assert
    expect(carts.saved).toHaveLength(1);
    expect(view.items[0]?.quantity).toBe(2);
  });

  it('addCartItem_givesUp_afterMaxAttemptsOfConflict', async () => {
    // Arrange
    const carts = new FakeCarts();
    carts.conflictsLeft = MAX_ATTEMPTS;

    // Act
    const result = addCartItem(deps(carts), { userId: 'u1', productId: 'gpu-1', quantity: 1 });

    // Assert
    await expect(result).rejects.toBeInstanceOf(CartVersionConflictError);
    expect(carts.saved).toHaveLength(0);
  });

  it('addCartItem_doesNotSave_whenBusinessRuleFails', async () => {
    // Arrange: ram còn 2, thêm 3
    const carts = new FakeCarts();

    // Act
    const result = addCartItem(deps(carts), { userId: 'u1', productId: 'ram-1', quantity: 3 });

    // Assert
    await expect(result).rejects.toBeInstanceOf(QuantityLimitError);
    expect(carts.saved).toHaveLength(0);
  });
});

describe('updateCartItem', () => {
  it('updateCartItem_setsQuantity', async () => {
    // Arrange
    const carts = new FakeCarts({ lines: [gpuLine], version: 'v1' });

    // Act
    const view = await updateCartItem(deps(carts), {
      userId: 'u1',
      productId: 'gpu-1',
      quantity: 5,
    });

    // Assert
    expect(view.items[0]?.quantity).toBe(5);
    expect(carts.saved[0]?.updatedAt).toBe(NOW);
  });

  it('updateCartItem_throwsCartItemNotFound_whenNotInCart', async () => {
    // Act
    const result = updateCartItem(deps(new FakeCarts()), {
      userId: 'u1',
      productId: 'gpu-1',
      quantity: 2,
    });

    // Assert
    await expect(result).rejects.toBeInstanceOf(CartItemNotFoundError);
  });
});

describe('removeCartItem', () => {
  it('removeCartItem_savesEmptyCart_whenLastLineRemoved', async () => {
    // Arrange
    const carts = new FakeCarts({ lines: [gpuLine], version: 'v1' });

    // Act
    const view = await removeCartItem(deps(carts), { userId: 'u1', productId: 'gpu-1' });

    // Assert
    expect(view).toEqual({ items: [], totalAmount: 0 });
    expect(carts.saved[0]?.lines).toEqual([]);
  });
});

describe('mergeCart', () => {
  it('mergeCart_savesMergedCartAndReturnsAdjustments', async () => {
    // Arrange: tài khoản có gpu 1; khách có gpu 2, ram 3 (ram chỉ còn 2), một món không tồn tại
    const carts = new FakeCarts({ lines: [gpuLine], version: 'v1' });
    const catalog = new FakeCatalog([gpu, ram]);

    // Act
    const result = await mergeCart(deps(carts, catalog), {
      userId: 'u1',
      items: [
        { productId: 'gpu-1', quantity: 2 },
        { productId: 'ram-1', quantity: 3 },
        { productId: 'khong-co', quantity: 1 },
      ],
    });

    // Assert
    expect(catalog.requests).toEqual([['gpu-1', 'ram-1', 'khong-co']]);
    expect(result.cart.items.map((i) => [i.productId, i.quantity])).toEqual([
      ['gpu-1', 3],
      ['ram-1', 2],
    ]);
    expect(result.mergedExisting).toEqual(['gpu-1']);
    expect(result.adjustments).toEqual([
      { productId: 'ram-1', reason: 'QUANTITY_LIMITED', requested: 3, merged: 2 },
      { productId: 'khong-co', reason: 'NOT_FOUND', requested: 1, merged: 0 },
    ]);
    expect(carts.saved).toHaveLength(1);
  });

  it('mergeCart_reportsOutcomeOfFinalAttempt_whenRetriedAfterConflict', async () => {
    // Arrange
    const carts = new FakeCarts({ lines: [gpuLine], version: 'v1' });
    carts.conflictsLeft = 1;

    // Act
    const result = await mergeCart(deps(carts), {
      userId: 'u1',
      items: [{ productId: 'gpu-1', quantity: 1 }],
    });

    // Assert
    expect(result.cart.items[0]?.quantity).toBe(2);
    expect(result.mergedExisting).toEqual(['gpu-1']);
  });
});
