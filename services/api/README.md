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
│     ├─ handler.ts     nhận request, kiểm input, gọi use case, đổi lỗi sang HTTP
│     ├─ routes.ts      bảng route → use case
│     ├─ application/   use case, chỉ gọi port
│     ├─ domain/        luật thuần, không I/O, không AWS SDK
│     ├─ ports.ts       interface
│     └─ infra/         adapter DynamoDB, SQS
└─ shared/              logger, tracer, lỗi chuẩn, http helpers, config, idempotency
test/
├─ helpers/             makeHandler, apiEvent, dữ liệu mẫu
└─ integration/         test adapter với DynamoDB Local qua Testcontainers
```

## Luật phụ thuộc

Kiểm bằng `pnpm deps:check` ở thư mục gốc; CI chặn nếu vi phạm.

- `domain` không import gì ngoài chính nó
- `application` chỉ import `domain` và `ports`
- `infra` hiện thực `ports`, được import AWS SDK
- Module không import module khác

## Script cần có trong `package.json`

`lint`, `typecheck`, `test` (unit + integration), `build`, `test:smoke`. Tên package là `api`.

Cách viết test: [docs/hands-on-testing-guide.md](../../docs/hands-on-testing-guide.md).
