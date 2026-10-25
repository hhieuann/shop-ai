# Runbook: hàng đợi đơn tồn đọng

Alarm: **không có** (đã dùng hết 10 alarm miễn phí của tài khoản chung, #252) · Dấu hiệu: dashboard và khách báo · Người trực: Hoàng · Cùng trang: [`dlq-orders.md`](dlq-orders.md)

Worker `order-processor` (Lambda `…-OrderProcessorFunction…`, code ở `services/api/src/modules/ordering/processorLambda.ts`) đọc hàng đợi đơn `…-OrdersQueue…`. Mỗi tin là một đơn vừa đặt (`PLACED`) hoặc vừa huỷ (`CANCELLED`). Event source đọc lô 5 tin, **tối đa 2 Lambda chạy cùng lúc** (`maxConcurrency` 2). Bình thường tin nằm trong hàng đợi vài giây. Tồn đọng nghĩa là đơn mới ở mãi `PENDING`: khách thấy "Chờ xác nhận", `events` chưa có PURCHASE, chưa có email.

## Dấu hiệu

- Dashboard `<tiền tố>-overview`, widget "Hàng đợi đơn: tuổi tin cũ nhất (giây)" trên **5 phút** (300 giây) và đang tăng.
- Widget "Hàng đợi đơn: tin đang chờ và tin trong DLQ": đường "đang chờ" tăng dần không giảm.
- Khách báo đặt hàng xong mà đơn ở `/orders` mãi "Chờ xác nhận".

## Kiểm tra nhanh (5 phút đầu)

1. Cùng dashboard, widget "Lambda: lỗi theo hàm", đường `order-processor`:
   - **Có lỗi:** worker nhận tin nhưng xử lý hỏng. Tin sẽ được giao lại, quá 3 lần thì vào DLQ: làm tiếp ở [`dlq-orders.md`](dlq-orders.md).
   - **Không lỗi, không chạy:** event source bị tắt hoặc Lambda không được gọi. Lambda console → `…-OrderProcessorFunction…` → **Configuration → Triggers**: trigger SQS phải `Enabled`.
   - **Không lỗi, chạy đều nhưng không kịp:** lượng đơn vượt sức 2 Lambda (thường chỉ khi load test).
2. Widget "Lambda cả tài khoản: chạy cùng lúc": throttle tăng thì xem thêm [`lambda-throttle.md`](lambda-throttle.md).
3. CloudWatch → Logs Insights, log group `…-OrderProcessorLogs…`, khung giờ 1 giờ:

   ```text
   fields @timestamp, level, message, orderId, correlationId, outcome, error.name, error.message
   | sort @timestamp desc
   | limit 50
   ```

   Log chỉ có `messageId`, `orderId`, `correlationId`, không có email, địa chỉ. Không chép thêm dữ liệu khách vào ghi chú sự cố.

## Đọc nhanh nguyên nhân thường gặp

| Thấy gì | Nghĩa là |
|---|---|
| `AccessDeniedException` trên bảng orders | Quyền IAM của worker bị đổi khi deploy |
| `AuthorizationError` khi gửi `order-confirmed` | Role worker mất `sns:Publish`, hoặc topic policy E9 viết sai ARN role |
| `Task timed out` | DynamoDB hoặc SNS chậm, hoặc khởi động lạnh; timeout là 10 giây |
| Không có log nào, tin vẫn tăng | Trigger SQS bị tắt hoặc Lambda bị xoá |

## Giảm thiểu

- **Do deploy mới:** rollback như [api-5xx.md](api-5xx.md) mục Giảm thiểu. Tin nằm chờ trong hàng đợi (giữ 4 ngày) nên **không mất đơn**: worker chạy lại thì tự xử lý hết.
- **Trigger bị tắt:** bật lại phải qua CDK + PR (không sửa tay trên console ở dev, staging, prod); trong lúc chờ, đơn vẫn an toàn trong hàng đợi.
- **Không kịp vì tải lớn:** tăng `maxConcurrency` trong `addOrderProcessor` (`infra/lib/api-stack.ts`) bằng PR. Khi đã có email SES, nhớ SES sandbox chỉ gửi 1 thư/giây.
- **Không** xoá tin trong hàng đợi để "giải toả": mỗi tin là một đơn của khách.

## Sửa gốc

Mở issue nhãn `bug`, ghi khoảng thời gian, số tin tồn, lỗi đọc được; sửa trên `fix/*` (dev, staging) hoặc `hotfix/*` (prod) theo docs/git-flow.md.

## Sau sự cố

- Kiểm widget tuổi tin cũ nhất về dưới vài giây, các đơn kẹt đã sang `CONFIRMED` hoặc `CANCELLED`, DLQ rỗng.
- Trên prod viết postmortem theo docs/postmortems/_template.md trong 48 giờ.
