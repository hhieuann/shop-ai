/**
 * API admin đơn hàng (ordering.md BR-15, BR-11, threat model L6, O3): khách thường và người không đăng
 * nhập không xem, không đổi trạng thái, không huỷ đơn bằng quyền admin. Người dùng E2E không thuộc
 * nhóm `admin`, nên ở đây chỉ kiểm 401 và 403; đường đúng của admin An kiểm tay trên staging (checklist rc.1, AD1–AD3).
 * Không ghi dữ liệu: mọi lệnh đổi trạng thái đều bị chặn trước khi tới bảng.
 * Cuối file: API admin sản phẩm (#546), cùng cách kiểm.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  call,
  ready,
  signIn,
  type Order,
  type OrderList,
  type ProductList,
  type ProductSummary,
} from './api.js';

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
    const cancel = await call(`/admin/orders/${unknownOrderId()}`, { method: 'DELETE' });

    // Assert: JWT authorizer chặn trước khi tới Lambda (body không theo RFC 9457, chỉ dựa vào mã)
    expect(list.status).toBe(401);
    expect(update.status).toBe(401);
    expect(cancel.status).toBe(401);
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

  it('adminCancelOrder_returns403_andOrderUnchanged_forCustomer', async () => {
    // Arrange: đơn gần nhất của chính người dùng E2E (nếu có) để xem có bị huỷ không
    const own = (await call('/orders?limit=1', { token })).body as OrderList;
    const target = own.items[0]?.orderId ?? unknownOrderId();
    const before =
      own.items.length > 0
        ? ((await call(`/orders/${target}`, { token })).body as Order).status
        : undefined;

    // Act: khách gọi API huỷ của admin (huỷ được cả đơn SHIPPED, threat model O3)
    const res = await call(`/admin/orders/${target}`, { method: 'DELETE', token });

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

/**
 * API admin sản phẩm (catalog.md BR-09, #546): không token thì 401 ở JWT authorizer; khách thường thì
 * 403 ở Lambda. Người dùng E2E không thuộc nhóm `admin` nên không tạo, sửa, xoá sản phẩm thật; đường
 * đúng của admin thử tay trên dev. Verify đọc lại qua API khách: sản phẩm không đổi, không bị ẩn.
 */
describe.skipIf(!ready)('E2E API admin sản phẩm: phân quyền', () => {
  let token = '';
  /** Một sản phẩm đang bán thật để thử sửa, xoá; đọc qua API khách */
  let product: ProductSummary;

  beforeAll(async () => {
    token = await signIn();
    const list = (await call('/products?limit=1&sort=newest')).body as ProductList;
    const first = list.items[0];
    if (!first) throw new Error('Môi trường E2E phải có ít nhất một sản phẩm đang bán');
    product = first;
  });

  /** 6 route theo contracts/openapi.yaml (tag admin) */
  const routes = () => [
    { path: `/admin/products?category=${product.category}` },
    {
      path: '/admin/products',
      method: 'POST',
      body: {
        name: 'Sản phẩm E2E không được tạo',
        category: product.category,
        brand: 'E2E',
        price: 1000,
        stock: 1,
        status: 'ACTIVE',
        description: 'Khách thường không được thêm sản phẩm.',
      },
    },
    { path: `/admin/products/${product.productId}` },
    {
      path: `/admin/products/${product.productId}`,
      method: 'PATCH',
      body: { updatedAt: '2026-01-01T00:00:00.000Z', price: 1, status: 'INACTIVE' },
    },
    { path: `/admin/products/${product.productId}`, method: 'DELETE' },
    { path: `/admin/products/${product.productId}/restore`, method: 'POST' },
  ];

  it('adminProductRoutes_return401_withoutToken', async () => {
    for (const route of routes()) {
      // Act
      const res = await call(route.path, { method: route.method, body: route.body });

      // Assert: JWT authorizer chặn trước khi tới Lambda (body không theo RFC 9457)
      expect(res.status, `${route.method ?? 'GET'} ${route.path}`).toBe(401);
    }
  });

  it('adminProductRoutes_return403_andProductUnchanged_forCustomer', async () => {
    // Arrange: giá và trạng thái trước khi thử
    const before = (await call(`/products/${product.productId}`)).body as ProductSummary;

    for (const route of routes()) {
      // Act: khách thường gọi API admin (catalog.md BR-09)
      const res = await call(route.path, { method: route.method, body: route.body, token });

      // Assert
      expect(res.status, `${route.method ?? 'GET'} ${route.path}`).toBe(403);
      expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    }

    // Verify: sản phẩm vẫn đang bán, giá không đổi (không bị sửa, ẩn hay xoá mềm)
    const after = await call(`/products/${product.productId}`);
    expect(after.status).toBe(200);
    expect((after.body as ProductSummary).price).toBe(before.price);
    expect((after.body as ProductSummary).status).toBe('ACTIVE');
  });
});
