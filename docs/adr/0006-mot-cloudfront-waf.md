# ADR-0006: Một CloudFront cho web và API, WAF gói Free

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An, Nhân

## Bối cảnh

Web tĩnh nằm trên S3, API nằm trên API Gateway. Cần WAF để chặn tấn công và spam, nhưng WAF trả theo dùng tốn khoảng $5 + $1 mỗi rule mỗi tháng. CloudFront có gói flat-rate Free: 1 triệu request, 100 GB mỗi tháng, WAF 5 rule, không tính phí vượt. Mỗi tài khoản được 3 gói Free.

## Quyết định

- Mỗi môi trường một distribution CloudFront gói Free: `/` → S3 qua Origin Access Control, `/api/*` → API Gateway.
- WAF 5 rule: core rule set, known bad inputs, IP reputation, giới hạn tốc độ, và một rule riêng cho `/api/events`.

## Hệ quả

- Dễ hơn: một WAF bảo vệ cả web và API; cùng tên miền nên không có CORS.
- Khó hơn: gọi thẳng URL của API Gateway sẽ đi vòng qua WAF. Nhân xử lý bằng header bí mật từ CloudFront, hoặc ghi rõ là giới hạn đã biết.
- Gói Free không hỗ trợ rule group tự tạo và một số tính năng CloudFront nâng cao; không cần cho dự án này.
