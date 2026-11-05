/**
 * Ghi sự kiện cho gợi ý (events.md mục 1, 5; contracts/openapi.yaml recordEvent).
 * Hai test đầu ghi 1 VIEW và 1 ADD_TO_CART thật của người dùng E2E vào bảng events: không có cách
 * xoá qua API, dòng tự hết hạn sau 90 ngày (TTL) và chỉ là thêm vài lượt xem cho pipeline gợi ý.
 * Các ca lỗi bị từ chối trước khi ghi.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { call, ready, signIn, type ProductList } from './api.js';

describe.skipIf(!ready)('E2E ghi sự kiện', () => {
  let token = '';
  let productId = '';

  beforeAll(async () => {
    token = await signIn();
    const { items } = (await call('/products?limit=1')).body as ProductList;
    if (!items[0]) throw new Error('Không có sản phẩm nào để ghi sự kiện');
    productId = items[0].productId;
  });

  it('recordEvent_returns202_forView', async () => {
    // Act
    const res = await call('/events', {
      method: 'POST',
      token,
      body: { productId, eventType: 'VIEW' },
    });

    // Assert: nhận, không có body
    expect(res.status).toBe(202);
    expect(res.body).toBeNull();
  });

  it('recordEvent_returns202_forAddToCart', async () => {
    // Act
    const res = await call('/events', {
      method: 'POST',
      token,
      body: { productId, eventType: 'ADD_TO_CART' },
    });

    // Assert
    expect(res.status).toBe(202);
  });

  it('recordEvent_returns400Problem_whenClientSendsPurchase', async () => {
    // Act: PURCHASE chỉ đến từ đơn đã xác nhận, client gửi thì là mua giả (threat model E1, E9)
    const res = await call('/events', {
      method: 'POST',
      token,
      body: { productId, eventType: 'PURCHASE' },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('recordEvent_returns400Problem_whenBodyHasUserIdOrTimestamp', async () => {
    // Act: userId lấy từ token, thời gian do server đặt (events.md mục 3, 5; threat model E3, E4)
    const res = await call('/events', {
      method: 'POST',
      token,
      body: {
        productId,
        eventType: 'VIEW',
        userId: 'nguoi-khac',
        timestamp: '2020-01-01T00:00:00Z',
      },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('recordEvent_returns401_withoutToken', async () => {
    // Act
    const res = await call('/events', {
      method: 'POST',
      body: { productId, eventType: 'VIEW' },
    });

    // Assert: khách vãng lai không ghi được sự kiện (nhóm chốt 17/10)
    expect(res.status).toBe(401);
  });
});
