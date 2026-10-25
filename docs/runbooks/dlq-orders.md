# Runbook: DLQ đơn hàng có tin

Alarm: `shop-prd-orders-dlq` (chỉ prod, #235) · Ngưỡng: DLQ có ≥ 1 tin · Người trực: Hoàng · Cùng trang: `shop-prd-order-enqueue-failed` (mục riêng bên dưới)

Dev và staging không có alarm (giữ dưới 10 alarm miễn phí của tài khoản chung): tự xem DLQ trên console SQS khi đơn kẹt ở `PENDING`, rồi làm theo các bước dưới.

Worker `order-processor` nhận tin `{ orderId, userId, correlationId }` từ hàng đợi đơn (ordering.md, luồng SQS). Một tin lỗi **3 lần** thì SQS chuyển sang DLQ. Đơn đó **vẫn ở `PENDING`**: đã trừ kho, khách chưa nhận email xác nhận, `events` chưa có `PURCHASE`. MVP không có trạng thái `FAILED`, nên phải xử lý bằng tay theo trang này.

Hàng đợi đơn và DLQ có từ #228. Worker là Lambda `…-OrderProcessorFunction…` (log group `…-OrderProcessorLogs…`), code ở `services/api/src/modules/ordering/processorLambda.ts` (#259). Dev và staging không có alarm, nhưng dashboard `<tiền tố>-overview` có widget số tin trong DLQ ở mọi môi trường. Tin còn tồn ở hàng đợi chính mà chưa vào DLQ thì xem [`sqs-backlog.md`](sqs-backlog.md).

## Dấu hiệu

- Email "ALARM: shop-…-orders-dlq".
- Khách báo đặt hàng xong nhưng không nhận email, đơn ở `/orders` mãi "Chờ xác nhận".

## Kiểm tra nhanh (5 phút đầu)

1. Mở dashboard `<tiền tố>-overview`: lỗi Lambda của worker và `ordering` có tăng cùng lúc không.
2. SQS → hàng đợi `…-OrdersDeadLetterQueue…` → **Send and receive messages** → **Poll for messages**. Ghi lại `orderId`, `correlationId` của từng tin. **Không** bấm Delete lúc này.
3. CloudWatch → Logs Insights, log group `…-OrderProcessorLogs…` của worker, khung giờ 1 giờ:

   ```text
   fields @timestamp, level, message, error.name, error.message
   | filter correlationId = "<correlationId>"
   | sort @timestamp asc
   ```

4. Không ghi email, SĐT, địa chỉ của khách vào ghi chú sự cố; chỉ dùng `orderId`.

## Đọc nhanh nguyên nhân thường gặp

| Thấy gì | Nghĩa là |
|---|---|
| `MessageRejected`, `Email address is not verified` (SES) | SES còn ở sandbox hoặc email gửi chưa xác minh |
| `AuthorizationError` khi gửi `order-confirmed` | Role worker thiếu `sns:Publish` trên topic |
| `AccessDeniedException` trên bảng `orders` | Quyền IAM của worker bị đổi khi deploy |
| `Task timed out` | SES, SNS chậm hoặc worker khởi động lạnh lâu |
| Lỗi zod khi đọc tin | Tin sai định dạng, có thể bị gửi tay; xem threat model O9 |

## Giảm thiểu

- **Lỗi đã sửa (deploy lại, quyền đã đủ):** SQS → DLQ → **Start DLQ redrive** về hàng đợi đơn. Worker chống trùng theo `orderId` (Powertools Idempotency), nên gửi lại không gửi email hai lần.
- **Lỗi chưa sửa được, khách đang chờ:** để tin nằm trong DLQ (giữ 14 ngày), báo khách qua kênh hỗ trợ.
- **Đơn không thể xử lý (tin hỏng, khách huỷ ngoài hệ thống):** admin huỷ đơn để hoàn kho (ordering.md BR-11, BR-12), rồi mới xoá tin khỏi DLQ.
- Do deploy mới: rollback như [api-5xx.md](api-5xx.md) mục Giảm thiểu.

## Alarm `shop-prd-order-enqueue-failed`: đơn đã ghi mà chưa gửi được tin

Alarm này (chỉ prod, #244) kêu khi metric `OrderEnqueueFailed` (namespace `shop-prd`, dimension `service = ordering`) ≥ 1 trong 5 phút: API đã ghi đơn `PENDING` và trả 201 cho khách, nhưng gửi tin vào hàng đợi đơn lỗi (ordering.md, luồng SQS bước 1). Tin không tới worker nên **không vào DLQ**; đơn nằm `PENDING` tới khi có người gửi lại.

1. Logs Insights, log group `…-OrderingLogs…`, khung giờ quanh lúc alarm:

   ```text
   fields @timestamp, orderId, correlationId, error.name, error.message
   | filter message = "Không gửi được tin đơn hàng cho worker"
   | sort @timestamp desc
   ```

2. Lỗi do quyền IAM hoặc hàng đợi bị xoá thì sửa trước (rollback như [api-5xx.md](api-5xx.md)).
3. Gửi lại tin cho từng `orderId`: SQS → hàng đợi `…-OrdersQueue…` → **Send and receive messages**, body `{"orderId":"<orderId>","userId":"<userId>","type":"PLACED","correlationId":"<correlationId>"}` (`userId` lấy từ đơn trong bảng orders). Worker chống trùng theo `orderId`, gửi thừa không hại.
4. Khách bấm lại "Xác nhận đặt hàng" với cùng Idempotency-Key thì API cũng tự gửi lại tin.

## Sửa gốc

Mở issue nhãn `bug`, ghi `orderId`, `correlationId`, lỗi đọc được; sửa trên `fix/*` (dev, staging) hoặc `hotfix/*` (prod) theo docs/git-flow.md.

## Sau sự cố

- Kiểm DLQ đã rỗng, alarm về OK, đơn đã sang `CONFIRMED` hoặc `CANCELLED`.
- Trên prod viết postmortem theo docs/postmortems/_template.md trong 48 giờ.
