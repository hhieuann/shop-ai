# services/workers

Lambda chạy nền, không nhận request từ web.

| Worker | Kích hoạt bởi | Làm gì | Người làm |
|---|---|---|---|
| `order-processor` | SQS hàng đợi đơn hàng | Xác nhận đơn, gửi tin `order-confirmed` qua SNS, gửi email qua SES (ordering.md, luồng SQS). Lỗi từng tin thì trả partial batch failure | Hoàng |
| `cost-breaker` | EventBridge Scheduler, mỗi giờ | Stop EC2 có tag `role=baseline` chạy quá 2 giờ | An |

**`order-processor` không nằm ở thư mục này** (chốt 25/10/2026): code ở module `ordering` của `services/api`
(`processorHandler.ts`, `processorLambda.ts`), như consumer PURCHASE của module `events` (#252). Worker dùng
chung `Order`, adapter bảng orders, `shared/` và luật layer của module, không phải chép lại hay import chéo
module; Lambda vẫn riêng, quyền riêng.

Worker ở thư mục này theo cùng layer với `services/api`: handler mỏng, logic trong `application` và `domain`.
