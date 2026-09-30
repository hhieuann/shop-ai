# contracts

`openapi.yaml` là nguồn sự thật của API (ADR-0011). Đổi API thì sửa file này **trước**, trong cùng PR với code.

| Việc | Lệnh |
|---|---|
| Kiểm file hợp lệ | `pnpm dlx @redocly/cli lint contracts/openapi.yaml` |
| Dựng API giả cho web | `pnpm dlx @stoplight/prism-cli mock contracts/openapi.yaml` |
| Xem tài liệu API | `pnpm dlx @redocly/cli preview-docs contracts/openapi.yaml` |

## Quy ước

- Đường dẫn `/api/v1/...`, danh từ số nhiều
- Lỗi dùng `application/problem+json` theo schema `Problem` (RFC 9457)
- Phân trang bằng `cursor` và `limit` (tối đa 50)
- Tiền là số nguyên VND; thời gian ISO 8601 UTC; ID dạng ULID
- `POST /api/v1/orders` bắt buộc header `Idempotency-Key`
