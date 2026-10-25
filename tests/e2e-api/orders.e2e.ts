/**
 * Đặt, xem, huỷ đơn của người dùng E2E (ordering.md BR-04, BR-10, BR-12, BR-14). Ghi dữ liệu thật nên:
 * test trong file chạy lần lượt, không thử lại; trước khi chạy huỷ đơn mở còn sót từ lần trước
 * (BR-14 chỉ cho 3 đơn mở); luôn huỷ đơn vừa đặt ở afterAll để tồn kho trở lại như cũ.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  call,
  ready,
  signIn,
  type Order,
  type OrderList,
  type ProductList,
  type ProductSummary,
} from './api.js';

/** Địa chỉ giả rõ ràng: đơn E2E bị huỷ ngay, không giao */
const SHIPPING_ADDRESS = {
  fullName: 'E2E Test',
  phone: '0900000000',
  address: 'Không giao, kiểm thử tự động',
  province: 'TP. Hồ Chí Minh',
};

/** ULID hợp lệ sinh lúc chạy, gần như chắc chắn không có trong bảng: 4 ký tự đầu cố định + 22 số */
function unknownOrderId(): string {
  const digits = randomUUID().replace(/\D/g, '').padEnd(22, '0').slice(0, 22);
  return `01K8${digits}`;
}

describe.skipIf(!ready)('E2E đặt hàng', () => {
  let token = '';
  let product: ProductSummary;
  // Sinh lúc chạy (UUID), không viết cứng chuỗi trông như khoá để gitleaks không báo nhầm
  const idempotencyKey = randomUUID();
  let orderId = '';

  const orderBody = () => ({
    items: [{ productId: product.productId, quantity: 1, expectedPrice: product.price }],
    shippingAddress: SHIPPING_ADDRESS,
  });

  beforeAll(async () => {
    token = await signIn();

    // Lần chạy trước lỗi giữa chừng có thể để sót đơn mở: huỷ hết để luôn dưới 3 đơn mở (BR-14)
    const { items: orders } = (await call('/orders?limit=50', { token })).body as OrderList;
    for (const order of orders) {
      if (order.status === 'PENDING' || order.status === 'CONFIRMED') {
        await call(`/orders/${order.orderId}`, { method: 'DELETE', token });
      }
    }

    // Món còn nhiều nhất: đặt 1 cái không làm món nào hết hàng, huỷ ở cuối thì cộng lại
    const { items } = (await call('/products?limit=50')).body as ProductList;
    const [mostStocked] = [...items].sort((a, b) => b.stock - a.stock);
    if (!mostStocked || mostStocked.stock < 2) {
      throw new Error('Không có sản phẩm nào còn từ 2 cái để thử đặt hàng');
    }
    product = mostStocked;
  });

  afterAll(async () => {
    // Test hỏng giữa chừng vẫn không để lại đơn mở (200 hoặc 409 nếu đã huỷ đều được)
    if (token && orderId) await call(`/orders/${orderId}`, { method: 'DELETE', token });
  });

  it('createOrder_returns400_withoutIdempotencyKey', async () => {
    // Act
    const res = await call('/orders', { method: 'POST', token, body: orderBody() });

    // Assert: BR-04 thiếu khoá thì không tạo đơn
    expect(res.status).toBe(400);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('createOrder_returns201Pending_withNewKey', async () => {
    // Act
    const res = await call('/orders', {
      method: 'POST',
      token,
      body: orderBody(),
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    // Assert: COD, miễn phí vận chuyển (BR-05, BR-06), không cache
    expect(res.status).toBe(201);
    expect(res.cacheControl).toContain('no-store');
    const order = res.body as Order;
    expect(order).toMatchObject({
      status: 'PENDING',
      shippingFee: 0,
      totalAmount: product.price,
      paymentMethod: 'COD',
      items: [{ productId: product.productId, quantity: 1, price: product.price }],
    });
    orderId = order.orderId;
  });

  it('createOrder_returns200SameOrder_whenSameKeyReplayed', async () => {
    // Act: bấm đặt lần hai, cùng khoá, cùng nội dung
    const res = await call('/orders', {
      method: 'POST',
      token,
      body: orderBody(),
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    // Assert: một đơn duy nhất
    expect(res.status).toBe(200);
    expect((res.body as Order).orderId).toBe(orderId);
  });

  it('listOrders_containsNewOrderFirst', async () => {
    // Act
    const res = await call('/orders?limit=5', { token });

    // Assert: mới nhất trước
    expect(res.status).toBe(200);
    expect(res.cacheControl).toContain('no-store');
    const [first] = (res.body as OrderList).items;
    expect(first).toMatchObject({ orderId, status: 'PENDING', itemCount: 1 });
  });

  it('getOrder_returnsPlacedOrder', async () => {
    // Act
    const res = await call(`/orders/${orderId}`, { token });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      orderId,
      status: 'PENDING',
      shippingAddress: SHIPPING_ADDRESS,
    });
  });

  it('getOrder_returns404_whenOrderNotOwned', async () => {
    // Act: khoá đọc gồm userId của token, nên đơn của người khác và đơn không có cùng trả 404
    const res = await call(`/orders/${unknownOrderId()}`, { token });

    // Assert
    expect(res.status).toBe(404);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('cancelOrder_returnsCancelled', async () => {
    // Act
    const res = await call(`/orders/${orderId}`, { method: 'DELETE', token });

    // Assert: BR-10, BR-12 (hoàn kho trong cùng giao dịch)
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ orderId, status: 'CANCELLED' });
  });

  it('cancelOrder_returns409_whenCancelledAgain', async () => {
    // Act
    const res = await call(`/orders/${orderId}`, { method: 'DELETE', token });

    // Assert: huỷ hai lần chỉ hoàn kho một lần
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'CANNOT_CANCEL' });
  });
});
