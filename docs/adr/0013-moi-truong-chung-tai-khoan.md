# ADR-0013: dev, staging, prod chung một tài khoản AWS

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An

## Bối cảnh

Doanh nghiệp thường tách mỗi môi trường một tài khoản AWS bằng AWS Organizations. Tài khoản Free plan không dùng được Organizations. Mỗi thành viên có một tài khoản riêng.

## Quyết định

- Mỗi người dùng tài khoản của mình làm sandbox (`shop-sbx-<tên>`).
- Tài khoản demo chạy ba stack tách biệt: `shop-dev`, `shop-stg`, `shop-prd`. Mỗi stack có bảng, bucket, user pool và distribution CloudFront riêng.
- Mỗi tài khoản được đúng 3 gói CloudFront Free, vừa đủ cho ba môi trường.

## Hệ quả

- Dễ hơn: không tốn thêm tài khoản; chi phí gom một chỗ.
- Khó hơn: một role có quyền rộng trong tài khoản demo có thể chạm vào cả ba môi trường. Role deploy tách theo môi trường và giới hạn bằng tên stack.
- Báo cáo ghi rõ đây là đánh đổi có chủ ý.
