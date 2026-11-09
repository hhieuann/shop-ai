// k6 load test theo mức người ảo (P2 trong docs/releases/v1.0.0-rc.1.md, engineering-plan.md mục 3).
//
// - Đọc: TIER người ảo duyệt sản phẩm, mỗi người nghỉ 3–6 giây giữa hai lần bấm như người thật.
//   Mục tiêu p95 ≤ 300 ms. Stage API Gateway giới hạn 50 request/giây (burst 100), nên 200 người ảo
//   khoảng 45 request/giây là mức cao nhất đo được mà chưa chạm giới hạn đó.
// - Ghi (chỉ khi có E2E_USERNAME, E2E_PASSWORD, COGNITO_CLIENT_ID): 1 người ảo đặt rồi huỷ ngay
//   từng đơn bằng người dùng E2E. Mục tiêu p95 đặt hàng ≤ 800 ms. Chỉ 1 người ảo vì mỗi tài khoản
//   tối đa 3 đơn đang mở (ordering.md BR-14); huỷ ngay nên tồn kho trả lại như cũ.
//
// Bắn thẳng vào URL API Gateway (output ApiUrl), không qua CloudFront và WAF.
// Ví dụ: docker run --rm -i -e BASE_URL=https://<api-id>.execute-api.ap-southeast-1.amazonaws.com
//   -e TIER=200 grafana/k6:2.3.0 run - < tests/load/tiers.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || '').replace(/\/+$/, '');
if (!BASE) throw new Error('Thiếu BASE_URL (URL API Gateway)');
const TIER = Number(__ENV.TIER || 50);
const RAMP = __ENV.RAMP || '1m';
const HOLD = __ENV.HOLD || '3m';
const REGION = __ENV.REGION || 'ap-southeast-1';
const WRITE =
  Boolean(__ENV.E2E_USERNAME) && Boolean(__ENV.E2E_PASSWORD) && Boolean(__ENV.COGNITO_CLIENT_ID);

const SHIPPING_ADDRESS = {
  fullName: 'K6 Load Test',
  phone: '0900000000',
  address: 'Không giao, kiểm thử tải',
  province: 'TP. Hồ Chí Minh',
};

const scenarios = {
  browse: {
    executor: 'ramping-vus',
    exec: 'browse',
    startVUs: 0,
    stages: [
      { duration: RAMP, target: TIER },
      { duration: HOLD, target: TIER },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
};
if (WRITE) {
  scenarios.order = {
    executor: 'constant-vus',
    exec: 'order',
    vus: 1,
    // Đặt hàng trong lúc phần đọc đang ở mức cao nhất
    startTime: RAMP,
    duration: HOLD,
  };
}

export const options = {
  scenarios,
  thresholds: {
    'http_req_duration{kind:read}': ['p(95)<300'],
    'http_req_failed{kind:read}': ['rate<0.01'],
    ...(WRITE
      ? {
          'http_req_duration{kind:write}': ['p(95)<800'],
          'http_req_failed{kind:write}': ['rate<0.01'],
        }
      : {}),
  },
  summaryTrendStats: ['avg', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

/** Chuỗi dạng UUID v4 cho Idempotency-Key (contract yêu cầu format uuid) */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function signIn() {
  const res = http.post(
    `https://cognito-idp.${REGION}.amazonaws.com/`,
    JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: __ENV.COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: __ENV.E2E_USERNAME, PASSWORD: __ENV.E2E_PASSWORD },
    }),
    {
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      tags: { name: 'cognito' },
    },
  );
  const token = res.status === 200 ? res.json('AuthenticationResult.AccessToken') : null;
  if (!token) throw new Error(`Đăng nhập người dùng E2E thất bại: ${res.status}`);
  return token;
}

/** Huỷ mọi đơn đang mở của người dùng E2E (lần chạy trước dừng giữa chừng có thể để sót) */
function cancelOpenOrders(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const res = http.get(`${BASE}/api/v1/orders?limit=50`, { headers, tags: { name: 'cleanup' } });
  for (const o of res.status === 200 ? res.json('items') : []) {
    if (o.status === 'PENDING' || o.status === 'CONFIRMED') {
      http.del(`${BASE}/api/v1/orders/${o.orderId}`, null, { headers, tags: { name: 'cleanup' } });
    }
  }
}

export function setup() {
  const res = http.get(`${BASE}/api/v1/products?limit=50`, { tags: { name: 'setup' } });
  const items = res.status === 200 ? res.json('items') : [];
  if (!items || items.length === 0)
    throw new Error(`Không đọc được danh sách sản phẩm: ${res.status}`);

  const data = { products: items.map((p) => ({ id: p.productId, category: p.category })) };
  if (WRITE) {
    data.token = signIn();
    cancelOpenOrders(data.token);
    // Món còn nhiều nhất: đặt 1 cái rồi huỷ ngay, không làm món nào hết hàng
    const [mostStocked] = [...items].sort((a, b) => b.stock - a.stock);
    if (!mostStocked || mostStocked.stock < 5) throw new Error('Không có món nào còn từ 5 cái');
    data.orderProduct = { id: mostStocked.productId, price: mostStocked.price };
  }
  return data;
}

/** Một lần bấm của khách đang xem hàng, các trang theo tỉ lệ gần với web thật */
export function browse({ products }) {
  const p = products[Math.floor(Math.random() * products.length)];
  const roll = Math.random();
  let url;
  let name;
  if (roll < 0.35) {
    url = `${BASE}/api/v1/products?limit=20&category=${p.category}`;
    name = 'products';
  } else if (roll < 0.7) {
    url = `${BASE}/api/v1/products/${p.id}`;
    name = 'product';
  } else if (roll < 0.85) {
    url = `${BASE}/api/v1/recs/also-bought?productId=${p.id}&limit=6`;
    name = 'also-bought';
  } else {
    url = `${BASE}/api/v1/recs/bestsellers?limit=10`;
    name = 'bestsellers';
  }
  const res = http.get(url, { tags: { kind: 'read', name } });
  check(res, { 'đọc trả 200': (r) => r.status === 200 });
  sleep(3 + Math.random() * 3);
}

/** Đặt 1 đơn rồi huỷ ngay (ordering.md BR-04, BR-10); chỉ đo thời gian đặt */
export function order({ token, orderProduct }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': uuidv4(),
  };
  const res = http.post(
    `${BASE}/api/v1/orders`,
    JSON.stringify({
      items: [{ productId: orderProduct.id, quantity: 1, expectedPrice: orderProduct.price }],
      shippingAddress: SHIPPING_ADDRESS,
    }),
    { headers, tags: { kind: 'write', name: 'place-order' } },
  );
  const placed = check(res, { 'đặt hàng trả 201': (r) => r.status === 201 });
  if (placed) {
    const cancel = http.del(`${BASE}/api/v1/orders/${res.json('orderId')}`, null, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { kind: 'cancel', name: 'cancel-order' },
    });
    check(cancel, { 'huỷ đơn trả 200': (r) => r.status === 200 });
  }
  sleep(2);
}

export function teardown({ token }) {
  if (token) cancelOpenOrders(token);
}
