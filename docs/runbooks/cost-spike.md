# Runbook: chi phí tăng bất thường

Không phải alarm CloudWatch mà là email của AWS Budgets, gửi tới email của An. Người trực: An.

Tài khoản demo ở **Free account plan**: không bị trừ tiền thẻ, chi phí trừ vào credit. Nhưng **hết credit hoặc hết hạn plan thì tài khoản bị đóng** cùng mọi môi trường (fcaj, shop-ai). Vì vậy chi phí tăng là việc phải xử lý ngay dù chưa mất tiền thật.

| Budget | Mức | Báo khi | Ghi chú |
|---|---|---|---|
| `FCAJ-Monthly-20USD` | $20/tháng | Thực tế 25%, 50%, 85%, 100% (khoảng $5, $10, $17, $20); dự báo 100% | Chính, tính cả phần credit trừ |
| `FCAJ-ZeroSpend` | $1 | Thực tế vượt $0,01 | Tính sau khi trừ credit nên chỉ kêu khi credit hết |
| `FCAJ-Budget-Task` | $100 | Thực tế 80%, 100%; dự báo 100% | Mốc lớn của cả đợt |

Chi phí bình thường (Cost Explorer, 01–08/11): dev khoảng $0,02, staging khoảng $0,02, prod dưới $0,01 cho cả 8 ngày. Từ khi WAF lên prod (`v1.0.0-rc.1`) cộng thêm khoảng $10/tháng.

## Dấu hiệu

- Email "AWS Budgets: FCAJ-Monthly-20USD has exceeded your alert threshold".
- Email của `FCAJ-ZeroSpend`: credit đã hết, nghiêm trọng nhất.

## Kiểm tra nhanh (10 phút đầu)

1. Billing → **Credits**: credit còn bao nhiêu, hạn plan.
2. Cost Explorer, tháng này, **Group by: Service**: dịch vụ nào tăng. Rồi **Group by: Tag `env`** (lọc `project = shop-ai`): môi trường nào.
3. Đổi Granularity sang **Daily**: tăng từ ngày nào, khớp với việc gì (deploy, load test, nightly, demo).

## Nguyên nhân thường gặp

| Dịch vụ tăng | Hay do | Xử lý |
|---|---|---|
| WAF | Web ACL prod tính theo giờ, khoảng $10/tháng (ADR-0006) | Đúng dự kiến khi WAF ở prod. Dọn theo [waf.md](waf.md) mục Dọn sau khi nộp bài |
| CloudWatch Logs | Log WAF, log `DEBUG` ở dev và staging, load test sinh nhiều log | Giảm thời gian giữ log, tắt log thừa |
| Lambda, API Gateway, DynamoDB | Load test chạy lâu hoặc chạy lặp; vòng lặp gọi lại | Dừng k6; xem Invocations theo hàm trên dashboard |
| X-Ray | Trace mọi request khi có tải lớn | Tạm giảm tải; trace tính theo số lượng |
| Data transfer, CloudFront | Bị gọi nhiều từ ngoài, bị dò | Xem log WAF ([waf.md](waf.md)), giới hạn tốc độ |

## Giảm thiểu

- Dừng ngay việc đang chạy: load test, script, job lặp.
- Môi trường không dùng: `cdk destroy` sandbox `shop-sbx-*`; tắt lịch job đêm ở môi trường đó (EventBridge Scheduler → Disable).
- Chi phí cố định không cần nữa: dọn WAF theo [waf.md](waf.md).
- Credit sắp hết mà vẫn cần tài khoản tới khi nộp bài: báo cả nhóm, dọn mọi thứ trừ prod. **Không bấm Upgrade plan** khi chưa thống nhất.

## Sau sự cố

Ghi số liệu (dịch vụ, môi trường, số tiền, ngày) vào worklog và mục chi phí của báo cáo FCAJ. Nguyên nhân là lỗi code thì viết postmortem theo `docs/postmortems/_template.md`.
