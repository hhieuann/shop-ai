/**
 * Giỏ của người dùng E2E (cart.md BR-02, BR-03, BR-04). Ghi dữ liệu thật nên:
 * test trong file chạy lần lượt (mặc định của Vitest), không thử lại; xoá món nếu lần chạy trước còn sót; luôn dọn ở afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, ready, signIn, type Cart, type ProductList } from './api.js';

describe.skipIf(!ready)('E2E giỏ hàng', () => {
  let token = '';
  let productId = '';

  const itemInCart = (cart: Cart) => cart.items.find((i) => i.productId === productId);

  beforeAll(async () => {
    token = await signIn();
    // Chọn món còn ít nhất 2 cái để thêm được 2 lần (BR-03: tối đa min(99, tồn kho))
    const { items } = (await call('/products?limit=50')).body as ProductList;
    const product = items.find((p) => p.stock >= 2);
    if (!product) throw new Error('Không có sản phẩm nào còn từ 2 cái để thử giỏ hàng');
    productId = product.productId;
    // Lần chạy trước lỗi giữa chừng có thể để sót món này: xoá trước (200 hoặc 404 đều được)
    await call(`/cart/items/${productId}`, { method: 'DELETE', token });
  });

  afterAll(async () => {
    if (token && productId) await call(`/cart/items/${productId}`, { method: 'DELETE', token });
  });

  it('addItem_returnsCartWithQuantity1_whenAddedFirstTime', async () => {
    // Act
    const res = await call('/cart/items', {
      method: 'POST',
      token,
      body: { productId, quantity: 1 },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(itemInCart(res.body as Cart)?.quantity).toBe(1);
  });

  it('addItem_accumulatesQuantity_whenAddedAgain', async () => {
    // Act
    const res = await call('/cart/items', {
      method: 'POST',
      token,
      body: { productId, quantity: 1 },
    });

    // Assert: thêm trùng thì cộng dồn (BR-04)
    expect(res.status).toBe(200);
    expect(itemInCart(res.body as Cart)?.quantity).toBe(2);
  });

  it('updateItem_setsQuantity_whenChangedTo1', async () => {
    // Act
    const res = await call(`/cart/items/${productId}`, {
      method: 'PUT',
      token,
      body: { quantity: 1 },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(itemInCart(res.body as Cart)?.quantity).toBe(1);
  });

  it('getCart_containsItem_withCurrentPrice', async () => {
    // Act
    const res = await call('/cart', { token });

    // Assert: giá trong giỏ là số nguyên VND (BR-06 giá hiện tại)
    expect(res.status).toBe(200);
    const item = itemInCart(res.body as Cart);
    expect(item).toMatchObject({ quantity: 1, price: expect.any(Number) });
  });

  it('deleteItem_removesItem_fromCart', async () => {
    // Act
    const res = await call(`/cart/items/${productId}`, { method: 'DELETE', token });

    // Assert
    expect(res.status).toBe(200);
    expect(itemInCart(res.body as Cart)).toBeUndefined();

    // Verify: đọc lại giỏ cũng không còn món
    const after = await call('/cart', { token });
    expect(itemInCart(after.body as Cart)).toBeUndefined();
  });
});
