/**
 * API admin đơn hàng (ordering.md BR-15, threat model L6, O3): khách thường và người không đăng nhập
 * không xem, không đổi được trạng thái đơn. Người dùng E2E không thuộc nhóm `admin`, nên ở đây chỉ kiểm
 * 401 và 403; đường đúng của admin An kiểm tay trên staging (checklist rc.1, AD1–AD3).
 * Không ghi dữ liệu: mọi lệnh đổi trạng thái đều bị chặn trước khi tới bảng.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { call, ready, signIn, type Order, type OrderList } from './api.js';

/** ULID đúng dạng sinh lúc chạy, gần như chắc chắn không có trong bảng */
function unknownOrderId(): string {
  const digits = randomUUID().replace(/\D/g, '').padEnd(22, '0').slice(0, 22);
  return `01K8${digits}`;
}

describe.skipIf(!ready)('E2E API admin đơn hàng: phân quyền', () => {
  let token = '';

  beforeAll(async () => {
    token = await signIn();
  });

  it('adminRoutes_return401_withoutToken', async () => {
    // Act
    const list = await call('/admin/orders?status=CONFIRMED');
    const update = await call(`/admin/orders/${unknownOrderId()}`, {
      method: 'PATCH',
      body: { status: 'SHIPPED' },
    });

    // Assert: JWT authorizer chặn trước khi tới Lambda (body không theo RFC 9457, chỉ dựa vào mã)
    expect(list.status).toBe(401);
    expect(update.status).toBe(401);
  });

  it('listAdminOrders_returns403_forCustomer', async () => {
    // Act
    const res = await call('/admin/orders?status=CONFIRMED', { token });

    // Assert: Lambda kiểm claim cognito:groups thật do HTTP API gửi (dạng chuỗi), không thấy admin
    expect(res.status).toBe(403);
    expect(res.contentType).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('updateOrderStatus_returns403_andOrderUnchanged_forCustomer', async () => {
    // Arrange: đơn gần nhất của chính người dùng E2E (nếu có) để xem trạng thái có bị đổi không
    const own = (await call('/orders?limit=1', { token })).body as OrderList;
    const target = own.items[0]?.orderId ?? unknownOrderId();
    const before =
      own.items.length > 0
        ? ((await call(`/orders/${target}`, { token })).body as Order).status
        : undefined;

    // Act: khách tự chuyển đơn của mình sang SHIPPED (threat model O3)
    const res = await call(`/admin/orders/${target}`, {
      method: 'PATCH',
      token,
      body: { status: 'SHIPPED' },
    });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    // Verify: đơn không đổi trạng thái
    if (before !== undefined) {
      const after = (await call(`/orders/${target}`, { token })).body as Order;
      expect(after.status).toBe(before);
    }
  });
});
