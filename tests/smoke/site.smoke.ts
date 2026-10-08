/**
 * Smoke test sau mỗi deploy (engineering-plan.md mục 8): vài lệnh gọi thật qua CloudFront để biết
 * web và API còn chạy. Chỉ đọc, không ghi dữ liệu, nên chạy được cả trên prod.
 *
 * BASE_URL là địa chỉ CloudFront của môi trường, vd. https://d2pq03areagblb.cloudfront.net
 *   BASE_URL=https://... pnpm --filter smoke test:smoke
 */
import { describe, expect, it } from 'vitest';

// Workflow truyền BASE_URL; vitest.config.ts chuyển sang SMOKE_BASE_URL vì Vite dùng trùng tên BASE_URL
const BASE_URL = process.env.SMOKE_BASE_URL?.replace(/\/+$/, '') || undefined;

const get = (path: string, init?: RequestInit) =>
  fetch(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(10_000) });

describe.skipIf(!BASE_URL)(`smoke ${BASE_URL ?? ''}`, () => {
  it('health_returnsOkAndIsNeverCached', async () => {
    // Act
    const res = await get('/api/v1/health');

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('productList_returnsItems_andFirstProductOpens', async () => {
    // Act
    const list = await get('/api/v1/products?limit=1');

    // Assert: đúng dạng; prod có thể chưa có sản phẩm nên chỉ gọi chi tiết khi có
    expect(list.status).toBe(200);
    const body = (await list.json()) as { items: { productId: string }[] };
    expect(Array.isArray(body.items)).toBe(true);
    const first = body.items[0];
    if (first) {
      const detail = await get(`/api/v1/products/${first.productId}`);
      expect(detail.status).toBe(200);
      expect(((await detail.json()) as { productId: string }).productId).toBe(first.productId);
    }
  });

  it('unknownProduct_returns404Problem', async () => {
    // Act
    const res = await get('/api/v1/products/smoke-khong-ton-tai');

    // Assert: lỗi theo RFC 9457
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  it('me_requiresSignIn', async () => {
    // Act
    const res = await get('/api/v1/me');

    // Assert: JWT authorizer của Cognito chặn khi không có token, body cố định (openapi Unauthorized)
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'Unauthorized' });
  });

  it('web_servesAppShellForHomeAndReactRoutes', async () => {
    for (const path of ['/', '/products/smoke-route']) {
      // Act
      const res = await get(path);

      // Assert: route của React cũng trả index.html (CloudFront Function)
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toContain('text/html');
    }
  });

  it('webConfig_pointsToCognito', async () => {
    // Act
    const res = await get('/config.json');

    // Assert: thiếu thì web không đăng nhập được
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      userPoolId: expect.stringMatching(/^[a-z0-9-]+_[A-Za-z0-9]+$/),
      userPoolClientId: expect.any(String),
    });
  });
});
