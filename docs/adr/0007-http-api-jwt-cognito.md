# ADR-0007: HTTP API với JWT authorizer của Cognito

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An

## Bối cảnh

API Gateway có REST API và HTTP API. WAF đã nằm ở CloudFront (ADR-0006), nên không cần gắn WAF trực tiếp vào API Gateway.

## Quyết định

Dùng HTTP API với JWT authorizer trỏ tới Cognito user pool. Web đăng nhập bằng luồng SRP. Nhóm `admin` trong Cognito bắt buộc MFA.

## Hệ quả

- Dễ hơn: rẻ hơn REST API khoảng 3,5 lần; ít cấu hình hơn; có throttle theo từng route.
- Khó hơn: không có usage plan và API key như REST API; dự án không cần.
- App client riêng cho E2E bật `USER_PASSWORD_AUTH`, chỉ tồn tại ở dev và staging.
- JWT authorizer trả 401 với body cố định `{"message":"Unauthorized"}`, không theo RFC 9457 như các lỗi khác. HTTP API không có Gateway Responses; CloudFront cũng không cho đổi body lỗi 401 (custom error response chỉ nhận 400, 403, 404, 405, 414, 416, 5xx). Hợp đồng ghi rõ ở response `Unauthorized` trong `contracts/openapi.yaml`; client chỉ dựa vào mã 401. Đã cân nhắc Lambda@Edge sửa body (thêm stack us-east-1, thêm độ trễ) và tự kiểm JWT trong Lambda (request chưa đăng nhập vẫn chạy Lambda); không đáng ở quy mô dự án.
