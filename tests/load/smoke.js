// k6 smoke: kịch bản rất nhỏ chạy mỗi đêm (nightly.yml) vào staging qua CloudFront.
// Chỉ đọc, không cần đăng nhập. Mục đích là phát hiện API chậm hẳn hoặc lỗi, không phải đo tải.
// Chạy tay: docker run --rm -i -e BASE_URL=https://<cloudfront> grafana/k6:2.3.0 run - < tests/load/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || '').replace(/\/+$/, '');
if (!BASE) throw new Error('Thiếu BASE_URL');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    // Qua CloudFront, có cả lần chạy lạnh của Lambda nên ngưỡng rộng hơn mục tiêu ở tiers.js
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const res = http.get(`${BASE}/api/v1/products?limit=20`);
  const items = res.status === 200 ? res.json('items') : [];
  if (!items || items.length === 0)
    throw new Error(`Không đọc được danh sách sản phẩm: ${res.status}`);
  return { productIds: items.map((p) => p.productId) };
}

export default function ({ productIds }) {
  const productId = productIds[Math.floor(Math.random() * productIds.length)];

  const responses = http.batch([
    ['GET', `${BASE}/api/v1/health`, null, { tags: { name: 'health' } }],
    ['GET', `${BASE}/api/v1/products?limit=20`, null, { tags: { name: 'products' } }],
    ['GET', `${BASE}/api/v1/products/${productId}`, null, { tags: { name: 'product' } }],
    ['GET', `${BASE}/api/v1/recs/bestsellers?limit=6`, null, { tags: { name: 'bestsellers' } }],
  ]);
  for (const res of responses) {
    check(res, { 'trả 200': (r) => r.status === 200 });
  }
  sleep(1);
}
