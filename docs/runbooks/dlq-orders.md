# Runbook: DLQ đơn hàng có tin

Alarm: `<tiền tố>-orders-dlq` · Ngưỡng: DLQ có ≥ 1 tin · Người trực: Hoàng

Worker `order-processor` nhận tin `{ orderId, userId, correlationId }` từ hàng đợi đơn (ordering.md, luồng SQS). Một tin lỗi **3 lần** thì SQS chuyển sang DLQ. Đơn đó **vẫn ở `PENDING`**: đã trừ kho, khách chưa nhận email xác nhận, `events` chưa có `PURCHASE`. MVP không có trạng thái `FAILED`, nên phải xử lý bằng tay theo trang này.

Hàng đợi đơn và DLQ có từ #228; worker làm ở PR sau. Trước khi có worker, tin chỉ nằm ở hàng đợi chính, chưa vào DLQ.

## Dấu hiệu

- Email "ALARM: shop-…-orders-dlq".
- Khách báo đặt hàng xong nhưng không nhận email, đơn ở `/orders` mãi "Chờ xác nhận".

## Kiểm tra nhanh (5 phút đầu)

1. Mở dashboard `<tiền tố>-overview`: lỗi Lambda của worker và `ordering` có tăng cùng lúc không.
2. SQS → hàng đợi `…-OrdersDeadLetterQueue…` → **Send and receive messages** → **Poll for messages**. Ghi lại `orderId`, `correlationId` của từng tin. **Không** bấm Delete lúc này.
3. CloudWatch → Logs Insights, log group của worker, khung giờ 1 giờ:

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

## Sửa gốc

Mở issue nhãn `bug`, ghi `orderId`, `correlationId`, lỗi đọc được; sửa trên `fix/*` (dev, staging) hoặc `hotfix/*` (prod) theo docs/git-flow.md.

## Sau sự cố

- Kiểm DLQ đã rỗng, alarm về OK, đơn đã sang `CONFIRMED` hoặc `CANCELLED`.
- Trên prod viết postmortem theo docs/postmortems/_template.md trong 48 giờ.
