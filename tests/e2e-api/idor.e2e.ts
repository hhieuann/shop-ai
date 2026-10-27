/**
 * Kiểm soát truy cập dữ liệu riêng của từng người (threat model O2, IDOR; docs/security/idor-review.md).
 * Chỉ có một người dùng E2E nên ca "người khác biết đúng orderId" nằm ở integration test
 * (orderDynamo.int.test.ts, mục IDOR); ở đây kiểm qua API thật những gì một người dùng tự thử được.
 * Không ghi dữ liệu: các lệnh huỷ ở đây đều trỏ tới đơn không có.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { call, ready, signIn } from './api.js';

/** ULID đúng dạng nhưng không phải đơn nào của người dùng E2E */
function unknownOrderId(): string {
  const digits = randomUUID().replace(/\D/g, '').padEnd(22, '0').slice(0, 22);
  return `01K8${digits}`;
}

/** Cursor tự chế: base64url của JSON, như API tạo, nhưng do client đặt */
function craftedCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

describe.skipIf(!ready)('E2E IDOR và dữ liệu riêng', () => {
  let token = '';

  beforeAll(async () => {
    token = await signIn();
  });

  it('cancelOrder_returns404_forOrderIdNotOwned', async () => {
    // Act: đường ghi, đoán orderId; khoá đọc gồm userId của token nên không chạm được đơn người khác
    const res = await call(`/orders/${unknownOrderId()}`, { method: 'DELETE', token });

    // Assert: 404 giống đơn không có, không 403 (không lộ đơn đó có tồn tại)
    expect(res.status).toBe(404);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('listOrders_returns400_whenCursorTampered', async () => {
    // Act: cursor không chứa ULID (vd. cố nhét userId người khác)
    const res = await call(
      `/orders?cursor=${craftedCursor({ o: 'not-an-order', userId: 'nguoi-khac' })}`,
      { token },
    );

    // Assert: cursor chỉ mang orderId và được kiểm dạng
    expect(res.status).toBe(400);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('listOrders_returnsOnlyOwnOrders_whenCursorHasValidOrderId', async () => {
    // Arrange
    const own = (await call('/orders?limit=50', { token })).body as {
      items: { orderId: string }[];
    };
    const ownIds = new Set(own.items.map((o) => o.orderId));

    // Act: cursor đúng dạng, trỏ tới orderId bất kỳ
    const res = await call(`/orders?limit=50&cursor=${craftedCursor({ o: unknownOrderId() })}`, {
      token,
    });

    // Assert: trang sau vẫn đọc partition của người trong token
    expect(res.status).toBe(200);
    const page = res.body as { items: { orderId: string }[] };
    expect(page.items.every((o) => ownIds.has(o.orderId))).toBe(true);
  });

  it.each(['/orders', '/cart', '/recs/for-you', '/me'])(
    'privateData_returns401_withoutToken %s',
    async (path) => {
      // Act
      const res = await call(path);

      // Assert: JWT authorizer chặn trước Lambda
      expect(res.status).toBe(401);
    },
  );

  it.each(['/orders', '/cart', '/recs/for-you', '/me'])(
    'privateData_isNotCacheable %s',
    async (path) => {
      // Act
      const res = await call(path, { token });

      // Assert: dữ liệu riêng không được CloudFront hay trình duyệt dùng chung giữa người dùng
      expect(res.status).toBe(200);
      expect(res.cacheControl).toContain('no-store');
    },
  );
});
