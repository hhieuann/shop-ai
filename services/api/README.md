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

Module mẫu để làm theo: `catalog` với `GET /api/v1/products/{productId}`.

## Dữ liệu mẫu cho sandbox

`seed/catalog/` có 2 sản phẩm ở dạng DynamoDB JSON: một `ACTIVE` (gọi API trả 200, có trong `GET /api/v1/products`) và một `INACTIVE` (trả 404 theo BR-04, không có trong danh sách). Mỗi item có `categoryStatus` (vd. `gpu#ACTIVE`) là khoá của GSI `byCategory`; thiếu thuộc tính này thì sản phẩm không xuất hiện trong danh sách. File chỉ dùng ký tự ASCII để AWS CLI trên Windows đọc được. Sau khi deploy sandbox, thay `<ProductsTableName>` bằng giá trị output `ProductsTableName` rồi chạy:

```bash
aws dynamodb put-item --region ap-southeast-1 --table-name <ProductsTableName> --item file://services/api/seed/catalog/rtx4070-active.json
aws dynamodb put-item --region ap-southeast-1 --table-name <ProductsTableName> --item file://services/api/seed/catalog/rtx3060-inactive.json
```

### Nạp cả bộ sản phẩm demo (104 sản phẩm)

`seed/catalog/products.json` có 104 sản phẩm, 13 loại × 8, có hàng hết, hàng sắp hết và 2 sản phẩm ngừng bán. Tên và hãng là sản phẩm có trên thị trường; giá và tồn kho là số tham khảo làm tròn, không phải giá thật. Không có ảnh để tránh dùng ảnh có bản quyền.

```bash
# Chỉ kiểm file, không ghi gì
pnpm --filter api seed:products --dry-run

# Ghi vào bảng (sau khi aws login và deploy sandbox)
pnpm --filter api seed:products --table <ProductsTableName>
```

- Script kiểm toàn bộ file trước khi ghi: sai một sản phẩm (thiếu trường, loại lạ, `productId` trùng hoặc không phải ULID, trường gõ sai tên) thì báo đúng vị trí và không ghi gì.
- Tự thêm `categoryStatus`, ghi theo lô 25 (giới hạn `BatchWriteItem`), tự thử lại phần DynamoDB chưa xử lý.
- Chạy lại nhiều lần không nhân đôi: ghi đè theo `productId`.
- Từ chối bảng prod (tên có đoạn `prd` hoặc `prod`, vd. `shop-prd-…`).
- Sửa `products.json` xong thì chạy `pnpm --filter api test:unit`: có test kiểm file vẫn hợp lệ và đủ 13 loại.
