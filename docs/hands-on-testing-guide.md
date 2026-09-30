# Hướng dẫn kiểm thử thực hành

Cách nhóm viết và chạy test: Unit, Integration, E2E. Ai viết code cũng viết test theo tài liệu này.

## 1. Mục tiêu

- Làm theo **tháp kiểm thử**: nhiều unit test (nhanh), ít integration test hơn, vài E2E test cho các luồng chính.
- Viết test theo **AAA+**: Arrange → Act → Assert → Verify.
- Integration test chạy với **DynamoDB thật** (DynamoDB Local) qua **Testcontainers**, không mock tầng dữ liệu.
- E2E gọi **API thật** trên dev/staging bằng **Postman Collection**, chạy tự động bằng **Newman** trong CI.

## 2. Môi trường cần có

- Node.js 24 và pnpm 12
- Docker Desktop đang chạy (Testcontainers cần Docker)
- Postman (chạy tay) và Newman (chạy trong CI hoặc dòng lệnh)
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
tests/e2e-api/
├─ postman/shop-e2e.postman_collection.json
├─ postman/dev.postman_environment.json
└─ postman/staging.postman_environment.json
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

## 6. E2E với Postman và Newman

### 6.1. Cấu trúc collection

| Thư mục | Request | Kiểm |
|---|---|---|
| `0 Auth` | Đăng nhập qua Cognito | 200, lưu `{{token}}` |
| `1 Catalog` | Lấy danh sách sản phẩm | 200, lưu `{{productId}}` |
| `2 Cart` | Thêm sản phẩm vào giỏ | 200, giỏ có đúng món vừa thêm |
| `3 Order` | Đặt hàng; gửi lại cùng `Idempotency-Key` | 201, lần hai trả về cùng `orderId` |
| `4 Negative` | Sai mật khẩu; thiếu token; xem đơn của người khác | 400 · 401 · 404 |
| `9 Cleanup` | Không gọi API | Xoá biến để lần chạy sau sạch |

### 6.2. Biến

| Biến | Lấy từ đâu |
|---|---|
| `baseUrl` | File environment (`dev` hoặc `staging`) |
| `region`, `cognitoClientId` | File environment |
| `username`, `password` | **Không ghi vào file.** Chạy tay thì điền vào *Current value* trong Postman; chạy CI thì truyền từ GitHub secret |
| `token`, `productId`, `orderId`, `idemKey` | Script tự đặt khi chạy |

### 6.3. Đăng nhập (request đầu tiên)

```text
POST https://cognito-idp.{{region}}.amazonaws.com/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth

{"AuthFlow":"USER_PASSWORD_AUTH","ClientId":"{{cognitoClientId}}",
 "AuthParameters":{"USERNAME":"{{username}}","PASSWORD":"{{password}}"}}
```

Tab **Tests**:

```js
pm.test('đăng nhập thành công', () => {
  pm.response.to.have.status(200);
  const token = pm.response.json().AuthenticationResult.AccessToken;
  pm.expect(token).to.be.a('string');
  pm.collectionVariables.set('token', token);
});
```

App client dùng cho E2E bật `USER_PASSWORD_AUTH` và **chỉ tồn tại ở dev và staging**. Web thật dùng luồng SRP.

### 6.4. Script sinh dữ liệu và kiểm kết quả

Tab **Pre-request** của request đặt hàng, để lần chạy nào cũng là đơn mới:

```js
pm.collectionVariables.set('idemKey', pm.variables.replaceIn('{{$guid}}'));
```

Tab **Tests**:

```js
pm.test('201 và đơn ở trạng thái PENDING', () => {
  pm.response.to.have.status(201);
  const body = pm.response.json();
  pm.expect(body.status).to.eql('PENDING');
  pm.collectionVariables.set('orderId', body.orderId);
});
```

Bước dọn dẹp ở cuối collection:

```js
['token', 'productId', 'orderId', 'idemKey'].forEach((k) => pm.collectionVariables.unset(k));
```

### 6.5. Tạo người dùng test (dev và staging, không bao giờ ở prod)

```bash
aws cognito-idp admin-create-user --user-pool-id <pool-id> \
  --username e2e-user@example.com --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id <pool-id> \
  --username e2e-user@example.com --password '<mật khẩu mạnh>' --permanent
```

Mật khẩu này lưu ở secret `E2E_PASSWORD` của environment `dev` và `staging` trên GitHub, không lưu ở đâu khác.

### 6.6. Chạy

- **Bằng Postman:** Import collection và environment → chọn environment → **Runner** → chọn collection → **Run**. Bảng kết quả hiện số test đạt và trượt; có thể export JSON hoặc HTML.
- **Bằng Newman** (giống hệt CI):

```bash
pnpm --filter e2e-api exec newman run postman/shop-e2e.postman_collection.json \
  -e postman/staging.postman_environment.json \
  --env-var "baseUrl=$BASE_URL" \
  --env-var "cognitoClientId=$COGNITO_CLIENT_ID" \
  --env-var "username=$E2E_USERNAME" \
  --env-var "password=$E2E_PASSWORD" \
  -r cli,htmlextra --reporter-htmlextra-export reports/index.html
```

## 7. Chạy test và xem báo cáo

| Việc | Lệnh | Báo cáo |
|---|---|---|
| Toàn bộ unit và integration | `pnpm test` | Kết quả trên terminal |
| Coverage của API | `pnpm --filter api exec vitest run --coverage` | `services/api/coverage/index.html` |
| Xem test bằng giao diện | `pnpm --filter api exec vitest --ui` | Mở trong trình duyệt |
| Test Python | `uv run pytest --cov --cov-report=html` (trong `data/`) | `data/htmlcov/index.html` |
| E2E | `pnpm test:e2e` | `tests/e2e-api/reports/index.html` |

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

**E2E (Postman)**

- [ ] Dùng biến `{{baseUrl}}`, `{{token}}`; không ghi cứng URL hay mật khẩu
- [ ] Pre-request script sinh dữ liệu ngẫu nhiên để chạy lại được nhiều lần
- [ ] Request nào cũng có test script kiểm status và body
- [ ] Có case âm: sai mật khẩu, thiếu token, xem đơn của người khác, gửi lại cùng `Idempotency-Key`
- [ ] Bước cuối dọn biến

**Dữ liệu và gợi ý (Python)**

- [ ] pytest theo AAA+
- [ ] Kiểm schema và phân phối dữ liệu trước khi train
- [ ] Chỉ số gợi ý không thấp hơn baseline trước khi bật phiên bản mới

## 9. Test nào chạy ở đâu trong CI

| Workflow | Khi nào | Chạy |
|---|---|---|
| `pr.yml` | Mỗi PR | Unit, integration (Testcontainers), lint, kiểm luật layer, quét bảo mật |
| `deploy.yml` | Merge vào `develop` hoặc `release/*` | Smoke test và E2E Newman trên dev hoặc staging |
| `deploy-prod.yml` | Có tag `v*` | Smoke test trên prod |
| `nightly.yml` | 2:00 mỗi đêm | OWASP ZAP, Schemathesis, audit thư viện, k6 |

## 10. Tóm lại

- **Unit** kiểm phần logic nhỏ nhất: luật trong domain, use case, handler. Nhanh, chạy mỗi lần lưu file.
- **Integration** kiểm phần ghép với dữ liệu thật: repository với DynamoDB Local qua Testcontainers.
- **E2E** kiểm cả luồng qua API thật: đăng nhập → xem hàng → giỏ → đặt hàng, cùng các case âm.
