# Runbook: API trả lỗi 5xx

Alarm: `<tiền tố>-api-5xx` (vd. `shop-prd-api-5xx`) · Ngưỡng: ≥ 3 lỗi 5xx trong 5 phút · Người trực: An, dự phòng Hoàng

## Dấu hiệu

- Email "ALARM: shop-…-api-5xx" từ SNS.
- Người dùng thấy trang báo lỗi, không xem được sản phẩm, không thêm được giỏ.

## Kiểm tra nhanh (5 phút đầu)

1. **Có đang deploy không?** Mở tab Actions của repo, xem có workflow Deploy chạy trong 30 phút qua không. Lỗi bắt đầu ngay sau một lần deploy thì nghi bản mới nhất trước tiên.
2. **Route nào lỗi:** CloudWatch → **Log Management** → tick log group `<tiền tố>-api-ApiAccessLogs…` → **View in Logs Insights** → khung giờ 1 giờ → chạy:

   ```text
   fields @timestamp, routeKey, status, integrationError, requestId
   | filter status >= 500
   | stats count(*) as loi by routeKey, status
   | sort loi desc
   ```

   Kết quả hiện dạng biểu đồ đường khó đọc: bấm **View data** để xem bảng. Biểu đồ cột phía trên cho biết lỗi bắt đầu từ giờ nào.

3. **Lambda báo gì:** lấy một `requestId` ở bước 2, chọn log group của module đó (`…-CatalogLogs…`, `…-CartLogs…`, `…-AccountLogs…`) và chạy:

   ```text
   fields @timestamp, message, routeKey, error.name, error.message
   | filter level = "ERROR" and traceId = "<requestId>"
   ```

   `traceId` trong log Lambda chính là `requestId` của API Gateway.
4. **Xem đường đi:** CloudWatch → X-Ray traces → lọc `annotation.statusCode >= 500` → mở một trace, xem bước nào đỏ (Lambda, DynamoDB, Cognito).

## Đọc nhanh nguyên nhân thường gặp

| Thấy gì | Nghĩa là |
|---|---|
| `integrationError` có `Internal server error` / Lambda timeout | Lambda lỗi hoặc chạy quá thời gian (catalog, cart 10 s; health, account 3 s) |
| Log Lambda có `AccessDeniedException` | Thiếu quyền IAM sau khi đổi CDK: kiểm PR gần nhất có sửa `addToRolePolicy` |
| Log Lambda có `ValidationException` từ DynamoDB | Code đọc/ghi sai tên thuộc tính hoặc khoá |
| `status` là 429 chứ không phải 5xx | Không thuộc runbook này: chạm giới hạn 50 request/giây của stage |

## Giảm thiểu

- **Do bản deploy mới (dev, staging):** mở PR revert merge commit gây lỗi:

  ```bash
  git revert -m 1 <mã commit merge>
  ```

  CI xanh thì merge, môi trường tự deploy lại bản cũ.
- **Do bản deploy mới (prod):** Actions → workflow **Deploy prod** → chọn lần chạy của **tag trước** (vd. `v0.1.0`) → **Re-run all jobs**. Workflow lấy đúng code của tag cũ; cần một người khác duyệt như lúc phát hành.
- **Không do deploy** (vd. DynamoDB, Cognito của AWS lỗi): xem [AWS Health Dashboard](https://health.aws.amazon.com/health/status) cho ap-southeast-1, báo nhóm, chờ và theo dõi.

## Sửa gốc

Prod: tạo hotfix theo [git-flow.md](../git-flow.md) mục 4.5. Dev, staging: PR `fix/<số-issue>-…` như thường. Thêm test tái hiện lỗi trước khi sửa.

## Sau sự cố

- Alarm về `OK` sẽ có email "OK: …". Kiểm lại smoke test xanh.
- Sự cố trên prod: viết postmortem theo [_template.md](../postmortems/_template.md) trong 48 giờ.
