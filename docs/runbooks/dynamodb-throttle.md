# Runbook: DynamoDB bị throttle

Alarm: **không có** (đã dùng hết 10 alarm miễn phí của tài khoản chung, #252) · Dấu hiệu: dashboard, alarm API và khách báo · Người trực: Hoàng · Cùng trang: [`api-5xx.md`](api-5xx.md), [`sqs-backlog.md`](sqs-backlog.md), [`lambda-throttle.md`](lambda-throttle.md)

Mọi bảng của shop là **on-demand** (ADR-0012): không đặt trước sức đọc, ghi nên bình thường không bị throttle. On-demand vẫn từ chối request (throttle) khi:

- lưu lượng tăng **quá gấp đôi đỉnh trước đó** trong khoảng 30 phút (bảng chưa kịp mở rộng), ví dụ load test bắt đầu đột ngột;
- dồn vào **một partition nóng** (một khoá được đọc, ghi liên tục): mỗi partition chỉ chịu khoảng 3.000 đơn vị đọc hoặc 1.000 đơn vị ghi mỗi giây; ví dụ một người bấm đặt hàng liên tục, cùng item `#OPEN`, hoặc cùng giỏ;
- chạm **giới hạn của bảng hoặc của tài khoản** trong vùng (mặc định 40.000 đơn vị đọc, ghi mỗi giây mỗi bảng).

SDK trong Lambda tự thử lại vài lần khi bị throttle, nên throttle ngắn thường chỉ làm API chậm hơn. Throttle kéo dài thì request lỗi: khách thấy lỗi 500 hoặc trang tải lâu, worker xác nhận đơn chậm hơn.

## Dấu hiệu

- Dashboard `<tiền tố>-overview`, biểu đồ **"DynamoDB: request bị throttle theo bảng (mỗi 5 phút)"**: một đường khác 0. Bên trái là đọc (`ReadThrottleEvents`), bên phải là ghi (`WriteThrottleEvents`), mỗi đường mang tên bảng: `products`, `carts`, `cart-idempotency`, `orders`, `order-idempotency`, `events`, `recs`. Biểu đồ không tính throttle của index (GSI): xem thêm bước 4 bên dưới.
- Alarm `<tiền tố>-api-5xx` hoặc `<tiền tố>-api-latency-p95` kêu: hai alarm này có ở dev, staging và prod (không có ở sandbox); riêng throttle DynamoDB không có alarm.
- Log Lambda có `ThrottlingException`, `ProvisionedThroughputExceededException`, hoặc `TransactionCanceledException` với lý do `ThrottlingError`; X-Ray có đoạn DynamoDB màu đỏ hoặc tím (429).
- Hàng đợi đơn tồn đọng (worker bị throttle khi xác nhận đơn): làm tiếp ở [`sqs-backlog.md`](sqs-backlog.md).

## Kiểm tra nhanh (5 phút đầu)

1. **Bảng nào, đọc hay ghi:** đọc tên đường trên biểu đồ throttle. Đọc thì nghi API xem hàng, ghi thì nghi đặt hàng, giỏ, sự kiện.
2. **Ai đang gọi:** cùng dashboard, biểu đồ "Lambda: lỗi theo hàm" và "thời gian chạy p95": hàm nào lỗi, chậm cùng lúc với đường throttle.

   | Bảng | Ai đọc, ghi |
   |---|---|
   | `products` | catalog (Query GSI), cart, ordering (trừ kho), recommendation, job gợi ý đêm (Scan chỉ đọc, ADR-0017), custom resource nạp sản phẩm khi deploy |
   | `carts`, `cart-idempotency` | cart; ordering (bỏ món khỏi giỏ khi đặt) |
   | `orders`, `order-idempotency` | ordering, admin đơn hàng, worker `order-processor` |
   | `events` | events (`POST /api/v1/events`), consumer PURCHASE, job gợi ý đêm (Scan chỉ đọc) |
   | `recs` | recommendation (đọc), job gợi ý đêm (ghi) |

3. **Có đang tải lớn không:** k6 trên staging (chung tài khoản với prod), job gợi ý đêm (02:00 giờ Việt Nam, xem [`recs-pipeline.md`](recs-pipeline.md)), deploy vừa nạp sản phẩm, hay WAF thấy lượng request lạ ([`waf.md`](waf.md), chỉ prod).
4. **Index:** CloudWatch → Metrics → DynamoDB → *Table Metrics* → chọn bảng, xem thêm dòng có `GlobalSecondaryIndexName` (`byCategory` của products, `byStatus` của orders).
5. **Log:** CloudWatch → Logs Insights, chọn log group của các Lambda vừa tìm được, khung giờ 1 giờ:

   ```text
   fields @timestamp, @log, level, message, routeKey, correlationId, error.name, error.message
   | filter error.name like /Throttl|ProvisionedThroughputExceeded|TransactionCanceled/
      or @message like /ThrottlingError/
   | stats count() as lan by @log, error.name, bin(5m)
   | sort lan desc
   ```

   Log chỉ có mã đơn, `correlationId`, không có email, địa chỉ. Không chép thêm dữ liệu khách vào ghi chú sự cố.

## Đọc nhanh nguyên nhân thường gặp

| Thấy gì | Nghĩa là |
|---|---|
| Throttle ngay lúc k6 bắt đầu, hết sau vài phút | Lưu lượng tăng quá gấp đôi đỉnh cũ; bảng tự mở rộng, thường tự hết |
| Throttle `products` hoặc `events` lúc khoảng 02:00 | Job gợi ý đêm Scan cả bảng cùng lúc với API |
| Throttle `products` ngay sau deploy | Custom resource nạp lại 104 sản phẩm cùng lúc với lưu lượng thật |
| Chỉ một vài khách bị lỗi, bảng `orders` hoặc `carts` | Partition nóng: một người (hoặc bot) gửi rất nhiều request vào cùng `userId` |
| Throttle kéo dài, tăng đều, không có load test | Lưu lượng thật hoặc bị spam; xem WAF, xem có vòng lặp gọi DynamoDB trong code mới deploy |
| Có `Scan` trong X-Ray của API | Code API lỡ dùng Scan (quy ước cấm, chỉ job đêm được Scan): lỗi code |

## Giảm thiểu

- **Do load test:** dừng k6, đợi 5 phút. Lần sau tăng tải dần (ramp-up), không bắt đầu ở mức cao.
- **Do job gợi ý đêm:** để job chạy xong; job thử lại theo lịch đêm sau. Nếu ảnh hưởng prod nhiều lần, mở issue cho Nhân giảm tốc độ Scan.
- **Do lưu lượng thật hoặc spam:** tạm hạ `throttle.rateLimit`, `burstLimit` của `HttpStage` `DefaultStage` (`infra/lib/api-stack.ts`, hiện 50 và 100 mỗi giây) bằng PR, để API trả 429 sớm thay vì đẩy lỗi vào DynamoDB; báo Nhân xem luật WAF.
- **Worker xác nhận đơn bị throttle:** giảm `batchSize` hoặc giữ `maxConcurrency` 2 trong `addOrderProcessor` bằng PR. Tin nằm chờ trong hàng đợi nên **không mất đơn**.
- **Do deploy mới:** rollback như [`api-5xx.md`](api-5xx.md) mục Giảm thiểu.

## Sửa gốc

Mở issue nhãn `bug`, ghi khoảng thời gian, bảng, đọc hay ghi, hàm gọi, số lần throttle; sửa trên `fix/*` (dev, staging) hoặc `hotfix/*` (prod) theo docs/git-flow.md. Partition nóng thì xem lại thiết kế khoá trong `docs/business/dynamodb-design.md`.

## Không làm

- **Không** chuyển bảng sang provisioned hay đổi sức đọc, ghi trên console: mọi thay đổi qua CDK + PR, bảng giữ on-demand (ADR-0012).
- **Không** sửa tay tài nguyên ở dev, staging, prod.
- **Không** xoá tin trong hàng đợi đơn hay dữ liệu trong bảng để "giảm tải".
- **Không** chép dữ liệu khách (email, địa chỉ, SĐT) từ bảng hay log vào issue, chat.

## Sau sự cố

Viết postmortem theo `docs/postmortems/_template.md` trong 48 giờ (S1 hoặc S2). Ghi lại bảng nào, nguyên nhân, đã đổi gì để lần sau phát hiện sớm hơn.
