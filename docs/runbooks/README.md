# Runbook

Mỗi alarm có một runbook: khi alarm kêu thì làm gì, theo thứ tự. Viết trước khi alarm được bật (Sprint 2).

| Runbook | Alarm | Người viết |
|---|---|---|
| [`api-5xx.md`](api-5xx.md) | `<tiền tố>-api-5xx`: ≥ 3 lỗi 5xx trong 5 phút | An |
| [`api-latency.md`](api-latency.md) | `<tiền tố>-api-latency-p95`: p95 ≥ 1 giây, 15 phút liền | An |
| [`lambda-errors.md`](lambda-errors.md) | `<tiền tố>-presignup-errors`: Lambda pre sign-up lỗi | An |
| [`lambda-throttle.md`](lambda-throttle.md) | `shop-prd-lambda-throttles`: Lambda bị throttle (chỉ prod) | An |
| [`recs-pipeline.md`](recs-pipeline.md) | `shop-prd-recs-pipeline-no-success`: job gợi ý mỗi đêm 26 giờ không chạy thành công (chỉ prod) | Nhân |
| [`waf.md`](waf.md) | Không có alarm: khách báo bị chặn, kiểm sau deploy prod có đổi WAF, chuyển core rule set sang chặn, dọn stack `shop-prd-waf` | Nhân |
| [`dlq-orders.md`](dlq-orders.md) | `shop-prd-orders-dlq`: DLQ đơn hàng có ≥ 1 tin (chỉ prod) | Hoàng |
| [`sqs-backlog.md`](sqs-backlog.md) | Không có alarm (đã hết 10 alarm miễn phí): xem widget tuổi tin cũ nhất của hàng đợi đơn trên dashboard, quá 5 phút là tồn đọng | Hoàng |
| [`dynamodb-throttle.md`](dynamodb-throttle.md) | Không có alarm (đã hết 10 alarm miễn phí): xem biểu đồ "DynamoDB: request bị throttle theo bảng" trên dashboard, đường nào khác 0 là có bảng bị throttle | Hoàng |
| [`cost-spike.md`](cost-spike.md) | Email AWS Budgets: `FCAJ-Monthly-20USD` vượt 25%, 50%, 85%, 100% (khoảng $5, $10, $17, $20) hoặc `FCAJ-ZeroSpend` (hết credit) | An |
| [`pitr-restore.md`](pitr-restore.md) | Không có alarm: dữ liệu `orders`, `products` bị xoá hoặc ghi sai; diễn tập P3 | An |
| `recs-pipeline.md` | Pipeline gợi ý đêm qua lỗi hoặc không chạy | Nhân |

## Mẫu

```markdown
# Runbook: <tên alarm>

## Dấu hiệu
Alarm nào kêu, người dùng thấy gì.

## Kiểm tra nhanh (5 phút đầu)
1. Mở dashboard "Shop tổng quan", xem ...
2. Tìm log theo traceId: ...

## Giảm thiểu
- Rollback: ...
- Tắt flag: ...

## Sửa gốc
Tạo hotfix theo docs/git-flow.md mục 4.5.

## Sau sự cố
Viết postmortem theo docs/postmortems/_template.md trong 48 giờ.
```
