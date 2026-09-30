# Runbook

Mỗi alarm có một runbook: khi alarm kêu thì làm gì, theo thứ tự. Viết trước khi alarm được bật (Sprint 2).

| Runbook | Alarm | Người viết |
|---|---|---|
| `api-5xx.md` | API 5xx trên 1% trong 5 phút | An |
| `lambda-throttle.md` | Lambda bị throttle | An |
| `dlq-orders.md` | DLQ đơn hàng có message | Hoàng |
| `sqs-backlog.md` | Message SQS cũ nhất quá 5 phút | Hoàng |
| `dynamodb-throttle.md` | DynamoDB bị throttle | Hoàng |
| `canary-rollback.md` | Canary ordering báo lỗi | An |
| `cost-spike.md` | Chi phí vượt $5, $10, $20 | An |
| `personalize-breaker.md` | Campaign Personalize sống quá 3 giờ | Nhân |

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
