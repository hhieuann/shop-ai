# Runbook: Lambda bị throttle

Alarm: `shop-prd-lambda-throttles` (chỉ prod) · Ngưỡng: ≥ 1 lần throttle trong 5 phút · Người trực: An

Throttle là khi AWS **từ chối chạy thêm Lambda** vì cả tài khoản đã chạm giới hạn số Lambda chạy cùng lúc. Giới hạn này **dùng chung cho sandbox, dev, staging, prod**: hiện là 1.000 (tăng từ 10 ngày 12/10/2026 qua Service Quotas).

## Dấu hiệu

- Email "ALARM: shop-prd-lambda-throttles".
- API prod trả 5xx rải rác (alarm `shop-prd-api-5xx` có thể kêu cùng lúc).

## Kiểm tra nhanh (5 phút đầu)

1. **Ai đang dùng hết chỗ:** CloudWatch → Metrics → Lambda → *Across all functions* → `ConcurrentExecutions` (Maximum, 1 phút). Rồi xem theo từng hàm (*By Function Name*) để tìm hàm chiếm nhiều nhất.
2. **Có đang load test không?** k6 chạy ở staging dùng chung giới hạn với prod. Đang chạy thì **dừng k6 ngay**.
3. **Giới hạn hiện tại:**

   ```bash
   aws lambda get-account-settings --region ap-southeast-1 --query AccountLimit
   ```

## Giảm thiểu

- Do load test: dừng k6, đợi 5 phút, alarm sẽ về `OK`.
- Do lưu lượng thật tăng hoặc bị spam: báo Nhân xem WAF (tuần 5); tạm hạ giới hạn request của stage trong `api-stack.ts` (`throttle.rateLimit`) để API trả 429 thay vì làm nghẽn cả tài khoản.

## Sau sự cố

Ghi lại đỉnh `ConcurrentExecutions` vào issue; trên prod viết postmortem trong 48 giờ.
