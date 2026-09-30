# services/workers

Lambda chạy nền, không nhận request từ web.

| Worker | Kích hoạt bởi | Làm gì | Người làm |
|---|---|---|---|
| `order-processor` | SQS hàng đợi đơn hàng | Xác nhận đơn, gửi email qua SES, báo admin qua SNS. Chạy lại không được gửi email hai lần (Powertools Idempotency); lỗi từng message thì trả partial batch failure | Hoàng |
| `cost-breaker` | EventBridge Scheduler, mỗi giờ | Xoá campaign Personalize sống quá 3 giờ; stop EC2 có tag `role=baseline` chạy quá 2 giờ | An |

Cùng layer với `services/api`: handler mỏng, logic trong `application` và `domain`.
