# Runbook: API chậm (p95 cao)

Alarm: `<tiền tố>-api-latency-p95` · Ngưỡng: p95 ≥ 1.000 ms trong 3 chu kỳ 5 phút liền, chỉ tính chu kỳ có từ 20 request · Mục tiêu bình thường: p95 ≤ 300 ms ([engineering-plan.md](../engineering-plan.md) mục 3) · Người trực: An

## Dấu hiệu

- Email "ALARM: shop-…-api-latency-p95".
- Web tải danh sách, giỏ hàng chậm thấy rõ.

## Kiểm tra nhanh (5 phút đầu)

1. **Route nào chậm:** CloudWatch → **Log Management** → tick log group `<tiền tố>-api-ApiAccessLogs…` → **View in Logs Insights**:

   ```text
   fields routeKey, integrationLatency
   | filter ispresent(integrationLatency)
   | stats count(*) as so_request, pct(integrationLatency, 95) as p95_ms by routeKey
   | sort p95_ms desc
   ```

2. **Chậm ở đâu:** X-Ray traces → lọc theo `annotation.routeKey = "GET /api/v1/products"` (route chậm nhất ở bước 1) → mở trace dài nhất: thời gian nằm ở `## handler`, ở DynamoDB, hay ở khởi tạo Lambda (`Initialization`).
3. **Có đang load test không?** Load test k6 chỉ chạy ở staging; nếu đang chạy thì chậm là đúng dự kiến, ghi lại số liệu.

## Đọc nhanh nguyên nhân thường gặp

| Thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| Nhiều `Initialization` dài | Khởi động lạnh do lưu lượng tăng đột ngột | Thường tự hết; kéo dài thì xem lại kích thước bundle |
| Subsegment DynamoDB dài, có `ThrottlingException` | Bảng bị nghẽn | Bảng on-demand tự giãn; nếu lặp lại thì xem có Scan nào lọt vào code không |
| `## handler` dài, DynamoDB ngắn | Code xử lý chậm (vd. tìm kiếm trên danh sách lớn) | Mở issue, đo lại bằng test |

## Giảm thiểu

Chậm sau một lần deploy: rollback như [api-5xx.md](api-5xx.md) mục Giảm thiểu.

## Sau sự cố

Ghi số liệu p95 trước và sau vào issue; trên prod viết postmortem trong 48 giờ.
