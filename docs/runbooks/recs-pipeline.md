# Runbook: job gợi ý mỗi đêm không chạy thành công

Alarm: `<tiền tố>-recs-pipeline-no-success` (chỉ prod) · Ngưỡng: 26 giờ liền không có lần chạy nào thành công · Người trực: Nhân

Job chạy lúc 02:00 giờ Việt Nam (EventBridge Scheduler), đọc bảng `products`, `events` và ghi bảng `recs` (recommendation.md mục 3). Job lỗi thì **web vẫn chạy**: API đọc phiên bản đang bật, các dòng của phiên bản đó còn hạn 7 ngày. Có khoảng 6 ngày để sửa trước khi "Thường mua kèm", "Dành cho bạn" rỗng và API trả hàng bán chạy.

## Dấu hiệu

- Email "ALARM: shop-prd-recs-pipeline-no-success".
- Con trỏ `META` / `ACTIVE#ALSO_BOUGHT` có `updatedAt` cũ hơn 1 ngày.

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
