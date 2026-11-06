# Runbook: job gợi ý mỗi đêm không chạy thành công

Alarm: `<tiền tố>-recs-pipeline-no-success` (chỉ prod) · Ngưỡng: 26 giờ liền không có lần chạy nào thành công · Người trực: Nhân

Job chạy lúc 02:00 giờ Việt Nam (EventBridge Scheduler), đọc bảng `products`, `events` và ghi bảng `recs` (recommendation.md mục 3). Job lỗi thì **web vẫn chạy**: API đọc phiên bản đang bật, các dòng của phiên bản đó còn hạn 7 ngày. Có khoảng 6 ngày để sửa trước khi "Thường mua kèm", "Dành cho bạn" rỗng và API trả hàng bán chạy.

## Dấu hiệu

- Email "ALARM: shop-prd-recs-pipeline-no-success".
- Con trỏ `META` / `ACTIVE#ALSO_BOUGHT` có `updatedAt` cũ hơn 1 ngày.

## Báo nhầm đã biết

- **Lần deploy đầu (hoặc tạo lại alarm):** alarm chuyển ALARM ngay vì 26 giờ trước chưa có lần chạy nào (giờ không có số liệu tính là 0, cố ý để bắt cả lỗi lịch không gọi Lambda). Chạy job bằng tay một lần (mục Giảm thiểu); alarm tự về OK.
- **Về OK chậm:** alarm tính theo khung 1 giờ, chỉ đánh giá khi khung kết thúc, cộng thêm độ trễ. Lần deploy v0.2.0: job chạy 12:46, khung 12:00–13:00 kết thúc lúc 13:00, alarm về OK lúc 13:46. Chưa đổi ngay thì đợi tới khoảng 1 giờ sau khi khung kết thúc rồi mới xem kỹ.

## Sau lần deploy đầu ở môi trường mới

Bảng `recs` trống nên khối gợi ý không hiện tới 02:00 đêm đó. Chạy job bằng tay một lần ngay sau deploy (Lambda → **Test** với sự kiện `{}`), rồi kiểm `GET /api/v1/recs/bestsellers` có món và trang chủ hiện khối gợi ý. Prod chưa có đơn nên bestsellers ra `NEWEST`; khối vẫn hiện, tiêu đề trung tính (#333).

## Kiểm tra nhanh

1. Lambda → hàm `…RecsPipelineFunction…` → **Monitor**: có Invocations đêm qua không, có Errors không.
2. Không có Invocations: EventBridge Scheduler → **Schedules** → lịch `…RecsPipelineNightly…` có đang **Enabled** không.
3. Có Errors: CloudWatch Logs Insights trên log group `…RecsPipelineLogs…`, khung 1 ngày:

   ```text
   fields @timestamp, @message
   | filter @message like /Traceback|Error|Task timed out/
   | sort @timestamp desc
   | limit 20
   ```

## Đọc nhanh nguyên nhân thường gặp

| Thấy gì | Nghĩa là |
|---|---|
| `AccessDeniedException` khi `Scan` bảng products | Code đọc thêm cột ngoài `productId, category, status, createdAt`, hoặc điều kiện IAM bị đổi (ADR-0017) |
| `Task timed out after 300.00 seconds` | Bảng `events` lớn hơn dự kiến; tăng timeout hoặc đọc theo khoảng thời gian |
| `KeyError: 'RECS_TABLE'` | Thiếu biến môi trường sau khi sửa CDK |

## Giảm thiểu

- Chạy lại bằng tay sau khi sửa: Lambda → **Test** với sự kiện `{}`. Chạy lại trong cùng ngày ra cùng phiên bản, không nhân đôi dữ liệu.
- Phiên bản mới sai: ghi đè con trỏ `ACTIVE#<loại>` về `activeVersion` cũ (dynamodb-design.md, bảng `recs`).

## Sau sự cố

Kiểm tra `GET /api/v1/recs/bestsellers` và `also-bought` của một sản phẩm trả đủ món; trên prod viết postmortem trong 48 giờ.
