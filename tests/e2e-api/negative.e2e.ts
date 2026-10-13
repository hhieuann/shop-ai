/**
 * Ca lỗi qua API thật. Không ghi dữ liệu: các lệnh thêm giỏ ở đây đều bị từ chối trước khi ghi.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { call, initiateAuth, ready, signIn } from './api.js';

describe.skipIf(!ready)('E2E ca lỗi', () => {
  let token = '';

  beforeAll(async () => {
    token = await signIn();
  });

  it('cart_returns401_withoutToken', async () => {
    // Act
    const res = await call('/cart');

    // Assert: JWT authorizer chặn trước Lambda, body cố định (openapi Unauthorized)
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  it('cart_returns401_withInvalidToken', async () => {
    // Act: chuỗi ngẫu nhiên không phải JWT, sinh lúc chạy
    const res = await call('/cart', { token: randomUUID() });

    // Assert
    expect(res.status).toBe(401);
  });

  it('addItem_returns400Problem_whenQuantityZero', async () => {
    // Arrange
    const [first] = ((await call('/products?limit=1')).body as { items: { productId: string }[] })
      .items;

    // Act
    const res = await call('/cart/items', {
      method: 'POST',
      token,
      body: { productId: first?.productId, quantity: 0 },
    });

    // Assert: lỗi theo RFC 9457
    expect(res.status).toBe(400);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('addItem_returns404Problem_whenProductMissing', async () => {
    // Act
    const res = await call('/cart/items', {
      method: 'POST',
      token,
      body: { productId: `e2e-${randomUUID()}`, quantity: 1 },
    });

    // Assert
    expect(res.status).toBe(404);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('productList_returns400Problem_whenCategoryUnknown', async () => {
    // Act
    const res = await call('/products?category=khong-co-loai-nay');

    // Assert
    expect(res.status).toBe(400);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('signIn_isRejected_whenPasswordWrong', async () => {
    // Act: email ngẫu nhiên không tồn tại; sai mật khẩu trên người dùng E2E thật sẽ làm Cognito tạm khoá nó
    const res = await initiateAuth(`e2e-${randomUUID()}@example.com`, randomUUID());

    // Assert: app client bật preventUserExistenceErrors nên trả lỗi chung, không lộ email có tồn tại không
    expect(res.status).toBe(400);
    expect(res.body.__type).toBe('NotAuthorizedException');
  });
});
