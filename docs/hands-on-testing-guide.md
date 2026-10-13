# Hướng dẫn kiểm thử thực hành

Cách nhóm viết và chạy test: Unit, Integration, E2E. Ai viết code cũng viết test theo tài liệu này.

## 1. Mục tiêu

- Làm theo **tháp kiểm thử**: nhiều unit test (nhanh), ít integration test hơn, vài E2E test cho các luồng chính.
- Viết test theo **AAA+**: Arrange → Act → Assert → Verify.
- Integration test chạy với **DynamoDB thật** (DynamoDB Local) qua **Testcontainers**, không mock tầng dữ liệu.
- E2E gọi **API thật** trên dev/staging bằng **Vitest + `fetch`** (cùng cách với smoke test), chạy tự động sau mỗi deploy ([ADR-0018](adr/0018-e2e-api-bang-vitest.md)).

## 2. Môi trường cần có

- Node.js 24 và pnpm 12
- Docker Desktop đang chạy (Testcontainers cần Docker)
- Postman (tuỳ chọn, để thử API bằng tay)
- Python 3.13 và uv, nếu làm phần `data/`
- VS Code hoặc WebStorm

## 3. Test đặt ở đâu

```text
services/api/
├─ src/modules/ordering/
│  ├─ domain/pricing.ts
│  ├─ domain/pricing.test.ts               unit: luật thuần
│  ├─ application/placeOrder.ts
│  ├─ application/placeOrder.test.ts       unit: use case, mock port
│  ├─ handler.ts
│  └─ handler.test.ts                      unit: handler, mock use case
└─ test/integration/
   └─ dynamoOrderRepository.int.test.ts    integration: DynamoDB Local qua Testcontainers
tests/e2e-api/                             E2E API: Vitest + fetch, *.e2e.ts (mục 6)
tests/e2e-ui/                              tuỳ chọn: Playwright cho 1–2 luồng giao diện
data/tests/                                pytest cho phần dữ liệu và gợi ý
```

## 4. Mỗi tầng test cái gì

| Tầng code | Loại test | Mock gì | Kiểm cái gì |
|---|---|---|---|
| `domain/` | Unit | Không mock gì, vì là hàm thuần | Luật nghiệp vụ: tính tiền, chuyển trạng thái, lọc gợi ý |
| `application/` (use case) | Unit | Mọi port: repository, publisher, reader | Điều phối đúng, xử lý lỗi, gọi port đúng số lần với đúng dữ liệu |
| `handler.ts` | Unit | Use case | Status code, body JSON, 400 / 401 / 403 |
| `infra/` (adapter) | Integration | Không mock | Đọc ghi DynamoDB thật, xử lý trùng khoá, không tìm thấy |
| Cả luồng qua API | E2E | Không mock | Đăng nhập → xem hàng → giỏ → đặt hàng trên môi trường thật |

## 5. AAA+: Arrange → Act → Assert → Verify

- **Arrange**: chuẩn bị dữ liệu và mock trả về gì.
- **Act**: gọi đúng một hành động cần test.
- **Assert**: kiểm kết quả trả về.
- **Verify**: kiểm tương tác. Mock nào được gọi, bao nhiêu lần, với dữ liệu gì; mock nào **không** được gọi.

Viết comment `// Arrange`, `// Act`, `// Assert`, `// Verify` để người review đọc nhanh.

### Đặt tên test: `action_expected_condition`

- `placeOrder_createsPendingOrder_whenAllItemsInStock`
- `placeOrder_throwsOutOfStock_whenAnyItemUnavailable`
- `postOrder_returns401_whenTokenMissing`

### Ví dụ: unit test cho use case

```ts
import { describe, it, expect, vi } from 'vitest';
import { placeOrder } from './placeOrder';
import { OutOfStockError } from '../domain/errors';

describe('placeOrder', () => {
  it('placeOrder_createsPendingOrder_whenAllItemsInStock', async () => {
    // Arrange
    const orders = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const stock = { isAvailable: vi.fn().mockResolvedValue(true) };
    const events = { orderPlaced: vi.fn().mockResolvedValue(undefined) };
    const input = {
      userId: 'u-1',
      idempotencyKey: 'key-1',
      items: [{ productId: 'gpu-rtx4070', quantity: 1, unitPrice: 15_990_000 }],
    };

    // Act
    const result = await placeOrder({ orders, stock, events }, input);

    // Assert
    expect(result.status).toBe('PENDING');
    expect(result.total).toBe(15_990_000);

    // Verify
    expect(orders.save).toHaveBeenCalledTimes(1);
    const saved = orders.save.mock.calls[0][0]; // xem dữ liệu ngay trước khi lưu
    expect(saved.userId).toBe('u-1');
    expect(saved.items).toHaveLength(1);
    expect(events.orderPlaced).toHaveBeenCalledTimes(1);
  });

  it('placeOrder_throwsOutOfStock_whenAnyItemUnavailable', async () => {
    // Arrange
    const orders = { findByIdempotencyKey: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const stock = { isAvailable: vi.fn().mockResolvedValue(false) };
    const events = { orderPlaced: vi.fn() };
    const input = {
      userId: 'u-1',
      idempotencyKey: 'key-2',
      items: [{ productId: 'psu-750w', quantity: 1, unitPrice: 2_190_000 }],
    };

    // Act
    const act = placeOrder({ orders, stock, events }, input);

    // Assert
    await expect(act).rejects.toBeInstanceOf(OutOfStockError);

    // Verify
    expect(orders.save).not.toHaveBeenCalled();
    expect(events.orderPlaced).not.toHaveBeenCalled();
  });
});
```

Vitest không có sẵn lệnh "không còn tương tác nào khác". Thay vào đó, kiểm số lần gọi của **mọi** mock liên quan, và dùng `not.toHaveBeenCalled()` cho mock không được phép gọi.

### Ví dụ: unit test cho handler

```ts
it('postOrder_returns400WithDetails_whenItemsEmpty', async () => {
  // Arrange
  const placeOrder = vi.fn();
  const handler = makeHandler({ placeOrder });
  const event = apiEvent({
    method: 'POST',
    path: '/api/v1/orders',
    userId: 'u-1',
    headers: { 'idempotency-key': 'key-3' },
    body: { items: [] },
  });

  // Act
  const res = await handler(event);

  // Assert
  expect(res.statusCode).toBe(400);
  expect(res.headers?.['content-type']).toBe('application/problem+json');
  expect(JSON.parse(res.body).errors[0].field).toBe('items');

  // Verify
  expect(placeOrder).not.toHaveBeenCalled();
});
```

`makeHandler` và `apiEvent` là helper dùng chung, đặt trong `services/api/test/helpers/`.

### Ví dụ: integration test với Testcontainers

```ts
import { beforeAll, afterAll, it, expect } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoOrderRepository } from '../../src/modules/ordering/infra/dynamoOrderRepository';
import { DuplicateOrderError } from '../../src/modules/ordering/domain/errors';

let container: StartedTestContainer;
let repo: DynamoOrderRepository;

beforeAll(async () => {
  container = await new GenericContainer('amazon/dynamodb-local:3.3.1')
    .withExposedPorts(8000)
    .start();
  const client = new DynamoDBClient({
    endpoint: `http://${container.getHost()}:${container.getMappedPort(8000)}`,
    region: 'ap-southeast-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' }, // DynamoDB Local không kiểm tra
  });
  await client.send(new CreateTableCommand(ordersTableDefinition('orders-test')));
  repo = new DynamoOrderRepository(client, 'orders-test');
}, 60_000);

afterAll(async () => {
  await container.stop();
});

it('save_throwsDuplicateOrder_whenIdempotencyKeyReused', async () => {
  // Arrange
  const order = sampleOrder({ idempotencyKey: 'key-dup' });
  await repo.save(order);

  // Act
  const act = repo.save({ ...order, orderId: 'another-id' });

  // Assert
  await expect(act).rejects.toBeInstanceOf(DuplicateOrderError);
});
```

Integration test không mock repository hay adapter. Nó kiểm cả happy path lẫn các lỗi hay gặp: trùng khoá, không tìm thấy, điều kiện ghi thất bại.

## 6. E2E API bằng Vitest

E2E gọi **API thật** qua CloudFront trên dev và staging, chạy tự động ngay sau smoke test mỗi lần deploy (`deploy.yml`). Viết bằng **Vitest + `fetch`**, cùng cách với smoke test, không cần thư viện nào thêm. Lý do không dùng Postman/Newman trong CI: [ADR-0018](adr/0018-e2e-api-bang-vitest.md). Postman vẫn dùng để thử API bằng tay, không commit collection.

### 6.1. Bộ test

```text
tests/e2e-api/
├─ package.json           tên package: e2e-api; script test:e2e = vitest run
├─ vitest.config.ts       đọc biến môi trường; thiếu thì bỏ qua cả bộ
├─ api.ts                 gọi API qua CloudFront, đăng nhập Cognito
├─ auth.e2e.ts
├─ catalog.e2e.ts
├─ cart.e2e.ts
├─ negative.e2e.ts
└─ reports/               junit.xml, đã có trong .gitignore
```

| File | Gọi | Kiểm |
|---|---|---|
| `auth.e2e.ts` | Đăng nhập Cognito, `GET /api/v1/me` | Có access token; `/me` trả 200 đúng email của người dùng E2E |
| `catalog.e2e.ts` | `GET /api/v1/products` (lọc, tìm, trang sau), `GET /api/v1/products/{id}` | Đúng dạng; trang sau theo `nextCursor` không trùng trang trước; lọc `gpu` chỉ ra `gpu`; tìm `chuot` ra tên có "chuột"; chi tiết 200 |
| `cart.e2e.ts` | `POST`, `PUT`, `DELETE` `/api/v1/cart/items…`, `GET /api/v1/cart` | Thêm 1 rồi thêm 1 thì cộng dồn 2; sửa về 1; xoá thì giỏ không còn món đó |
| `negative.e2e.ts` | Các lệnh gọi sai | Thiếu token, token sai: 401 `problem+json`; số lượng 0, `category` lạ: 400; sản phẩm không có: 404; sai mật khẩu: Cognito từ chối |
| `order.e2e.ts` (Sprint 2) | `POST /api/v1/orders` hai lần cùng `Idempotency-Key` | 201, lần hai trả cùng `orderId`; xem đơn của người khác: 404 |

### 6.2. Biến môi trường

| Biến | Lấy từ đâu |
|---|---|
| `BASE_URL` | URL CloudFront của môi trường; `deploy.yml` tự đọc từ output `WebUrl` |
| `COGNITO_CLIENT_ID` | Biến `E2E_COGNITO_CLIENT_ID` của environment trên GitHub (app client E2E) |
| `E2E_USERNAME`, `E2E_PASSWORD` | Biến và secret của environment. **Không ghi vào file nào** |
| `AWS_REGION` | Không đặt thì là `ap-southeast-1` |
| `COGNITO_ENDPOINT` | Tuỳ chọn, chỉ để chạy thử với Cognito giả ở máy |

- Thiếu `BASE_URL` hoặc một trong ba biến đăng nhập thì **bỏ qua cả bộ** (`describe.skipIf`) và in cảnh báo vàng trên GitHub Actions. Chạy ở máy hay ở PR không bị đỏ; environment chưa có người dùng E2E vẫn deploy được.
- **Bẫy `BASE_URL`:** Vite tự đặt `process.env.BASE_URL = '/'` trong lúc chạy test. `vitest.config.ts` đọc biến này trước rồi chuyển cho test qua `E2E_BASE_URL`, giống `tests/smoke/vitest.config.ts`.

### 6.3. Đăng nhập Cognito không cần SDK

```ts
const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-amz-json-1.1',
    'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
  },
  body: JSON.stringify({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  }),
});
const token = (await res.json()).AuthenticationResult.AccessToken;
```

App client dùng cho E2E bật `USER_PASSWORD_AUTH` và **chỉ tồn tại ở dev và staging**. Web thật dùng luồng SRP.

### 6.4. Ghi dữ liệu an toàn

- Các file chạy **tuần tự** (`fileParallelism: false`) và **không thử lại** (`retry: 0`): bước giỏ ghi vào giỏ thật của người dùng E2E, thử lại có thể cộng dồn sai.
- Trước khi thêm, xoá món đó nếu lần chạy trước còn sót; `afterAll` luôn xoá món đã thêm, để giỏ sạch cho lần sau.
- Ca sai mật khẩu dùng **email ngẫu nhiên không tồn tại** (`randomUUID()`), không dùng người dùng E2E: sai nhiều lần thì Cognito tạm khoá đúng người dùng đó.
- Không ghi cứng token hay chuỗi trông như khoá trong test; sinh lúc chạy bằng `randomUUID()`.
- Viết theo AAA+ như mục 5, tên test `action_expected_condition`.

### 6.5. Tạo người dùng test (dev và staging, không bao giờ ở prod)

```bash
aws cognito-idp admin-create-user --user-pool-id <pool-id> \
  --username e2e-user@example.com --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id <pool-id> \
  --username e2e-user@example.com --password '<mật khẩu mạnh>' --permanent
```

Mật khẩu này lưu ở secret `E2E_PASSWORD` của environment `dev` và `staging` trên GitHub, không lưu ở đâu khác. Ghi `E2E_USERNAME` và `E2E_COGNITO_CLIENT_ID` (output `UserPoolE2eClientId` của stack api) vào biến của environment.

### 6.6. Chạy

```bash
# ở máy, gọi API dev (xin An thông tin người dùng E2E, không ghi vào file)
BASE_URL=https://<cloudfront dev> COGNITO_CLIENT_ID=<id> E2E_USERNAME=<email> E2E_PASSWORD=<mật khẩu> \
  pnpm --filter e2e-api test:e2e
```

Trên CI, `deploy.yml` chạy `pnpm run test:e2e` sau smoke test, truyền đủ biến ở mục 6.2. Kết quả hiện trên log; khi có lỗi, `tests/e2e-api/reports/junit.xml` được tải lên thành artifact `e2e-reports-<môi trường>`.

**Thử bằng tay với Postman** (tuỳ chọn): gọi Cognito như mục 6.3 để lấy token, rồi gửi request tới `{{baseUrl}}/api/v1/...` với header `Authorization: Bearer {{token}}`. Không lưu mật khẩu vào Postman workspace dùng chung, không commit collection.

## 7. Chạy test và xem báo cáo

| Việc | Lệnh | Báo cáo |
|---|---|---|
| Toàn bộ unit và integration | `pnpm test` | Kết quả trên terminal |
| Coverage của API | `pnpm --filter api exec vitest run --coverage` | `services/api/coverage/index.html` |
| Xem test bằng giao diện | `pnpm --filter api exec vitest --ui` | Mở trong trình duyệt |
| Test Python | `uv run pytest --cov --cov-report=html` (trong `data/`) | `data/htmlcov/index.html` |
| E2E | `pnpm test:e2e` (cần biến ở mục 6.2) | Terminal; `tests/e2e-api/reports/junit.xml` |

## 8. Checklist khi review test

**Use case (unit)**

- [ ] Mọi port là mock hoặc fake; không có I/O thật
- [ ] Chia rõ Arrange → Act → Assert → Verify
- [ ] Có case lỗi: không tìm thấy, dữ liệu sai, xung đột
- [ ] Soi dữ liệu truyền vào hàm lưu khi kết quả phụ thuộc vào nó
- [ ] Kiểm số lần gọi của mọi mock; mock không được gọi thì `not.toHaveBeenCalled()`
- [ ] Tên test theo `action_expected_condition`

**Handler**

- [ ] Mock use case, không gọi AWS
- [ ] Kiểm status code và body JSON, kể cả `application/problem+json` khi lỗi
- [ ] 401 khi thiếu token, 403 khi sai vai trò
- [ ] 400 kèm chi tiết từng trường khi input sai
- [ ] Tên test theo `action_expected_condition`

**Integration**

- [ ] DynamoDB Local qua Testcontainers; mỗi file test tạo bảng riêng
- [ ] Không mock repository hay adapter
- [ ] Có happy path và các lỗi hay gặp: trùng khoá, không tìm thấy, điều kiện ghi thất bại
- [ ] Dừng container trong `afterAll`

**E2E**

- [ ] URL, client ID, tài khoản lấy từ biến môi trường; không ghi cứng URL hay mật khẩu
- [ ] Thiếu biến thì bỏ qua cả bộ, không báo đỏ
- [ ] Mỗi lệnh gọi kiểm status và body
- [ ] Bước ghi dữ liệu chạy tuần tự, không thử lại, có bước dọn ở cuối; chạy lại nhiều lần vẫn xanh
- [ ] Có case âm: thiếu token, dữ liệu sai, không tìm thấy, sai mật khẩu (email ngẫu nhiên); khi có đặt hàng: gửi lại cùng `Idempotency-Key`, xem đơn của người khác

**Dữ liệu và gợi ý (Python)**

- [ ] pytest theo AAA+
- [ ] Kiểm schema và phân phối dữ liệu trước khi train
- [ ] Chỉ số gợi ý không thấp hơn baseline trước khi bật phiên bản mới

## 9. Test nào chạy ở đâu trong CI

| Workflow | Khi nào | Chạy |
|---|---|---|
| `pr.yml` | Mỗi PR | Unit, integration (Testcontainers), lint, kiểm luật layer, quét bảo mật |
| `deploy.yml` | Merge vào `develop` hoặc `release/*` | Smoke test và E2E API (Vitest) trên dev hoặc staging |
| `deploy-prod.yml` | Có tag `v*` | Smoke test trên prod |
| `nightly.yml` | 2:00 mỗi đêm | OWASP ZAP, Schemathesis, audit thư viện, k6 |

## 10. Tóm lại

- **Unit** kiểm phần logic nhỏ nhất: luật trong domain, use case, handler. Nhanh, chạy mỗi lần lưu file.
- **Integration** kiểm phần ghép với dữ liệu thật: repository với DynamoDB Local qua Testcontainers.
- **E2E** kiểm cả luồng qua API thật: đăng nhập → xem hàng → giỏ → đặt hàng, cùng các case âm.
