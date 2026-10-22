# ADR-0005: Lambda không đặt trong VPC

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An

## Bối cảnh

Lambda đặt trong VPC mà cần gọi dịch vụ AWS thì phải có NAT gateway (~$1–1,5/ngày) hoặc VPC endpoint. Dự án chỉ dùng DynamoDB, SQS, SNS, SES, đều gọi được qua endpoint công khai bằng quyền IAM.

## Quyết định

Không đặt Lambda trong VPC. Không tạo NAT gateway.

## Hệ quả

- Dễ hơn: không có chi phí mạng cố định; khởi động lạnh nhanh hơn.
- Khó hơn: nếu sau này cần RDS hay tài nguyên trong VPC thì phải xem lại quyết định này.
- Bản EC2 đối chứng dùng VPC mặc định, subnet public, chỉ bật lúc test.
