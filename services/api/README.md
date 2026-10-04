# services/api

API chạy trên AWS Lambda (Node.js 24, arm64), mỗi module một Lambda. Layer theo [ADR-0009](../../docs/adr/0009-layer-hexagonal-rut-gon.md).

## Cấu trúc

```text
src/
├─ modules/
│  ├─ catalog/          Hoàng
│  ├─ cart/             Hoàng
│  ├─ ordering/         Hoàng
│  ├─ admin/            Hoàng
│  ├─ recommendation/   An
│  └─ events/           Nhân
│     ├─ handler.ts     nhận request, chọn route, đổi lỗi sang HTTP
│     ├─ lambda.ts      ghép use case với adapter thật; CDK trỏ Lambda vào file này
│     ├─ routes.ts      bảng route → use case
│     ├─ application/   use case, chỉ gọi port
│     ├─ domain/        luật thuần, không I/O, không AWS SDK
│     ├─ ports.ts       interface
│     └─ infra/         adapter DynamoDB, SQS
└─ shared/              logger, tracer, lỗi chuẩn, http helpers, config, idempotency
test/
├─ helpers/             apiEvent, DynamoDB Local, dữ liệu mẫu
└─ integration/         test adapter với DynamoDB Local qua Testcontainers
```

## Luật phụ thuộc

Kiểm bằng `pnpm deps:check` ở thư mục gốc; CI chặn nếu vi phạm.

- `domain` không import gì ngoài chính nó
- `application` chỉ import `domain` và `ports`
- `infra` hiện thực `ports`, được import AWS SDK
- Module không import module khác

## Script

| Script | Việc |
|---|---|
| `pnpm --filter api test` | Toàn bộ unit và integration test; Docker Desktop phải đang chạy |
| `pnpm --filter api test:unit` | Chỉ unit test trong `src/` |
| `pnpm --filter api test:int` | Chỉ integration test, chạy DynamoDB Local qua Testcontainers |
| `pnpm --filter api lint` · `typecheck` | ESLint và kiểm tra kiểu |

Không có bước build riêng: CDK đóng gói từng Lambda bằng esbuild khi synth và deploy.

Module mẫu để làm theo: `catalog` với `GET /api/v1/products/{id}`.

## Dữ liệu mẫu cho sandbox

`seed/` chứa sản phẩm mẫu ở dạng DynamoDB JSON, chỉ dùng ký tự ASCII để AWS CLI trên Windows đọc được. Nạp vào bảng sau khi deploy sandbox; tên bảng lấy từ output `ProductsTableName`:

```bash
aws dynamodb put-item --region ap-southeast-1 --table-name <ProductsTableName> --item file://services/api/seed/catalog/gpu-rtx4070.json
```

Cách viết test: [docs/hands-on-testing-guide.md](../../docs/hands-on-testing-guide.md).
