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
