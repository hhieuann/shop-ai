# ADR-0012: DynamoDB mỗi module một bảng

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: Hoàng, An

## Bối cảnh

DynamoDB cho phép gộp mọi thực thể vào một bảng (single-table) hoặc tách mỗi loại một bảng. Hai người trong nhóm mới làm DynamoDB.

## Quyết định

Mỗi module sở hữu bảng riêng: `products`, `carts`, `orders`, `idempotency`, `events`, `recs`. Mọi bảng dùng on-demand. Ở prod, `orders` và `products` bật point-in-time recovery và chống xoá nhầm.

## Hệ quả

- Dễ hơn: dễ hiểu; quyền IAM cấp theo bảng; module không đụng dữ liệu của nhau.
- Khó hơn: truy vấn gộp nhiều loại thực thể cần nhiều lần gọi. Ở quy mô dự án này không đáng kể.
- Bảng chi tiết sẽ chốt khi có nghiệp vụ.
