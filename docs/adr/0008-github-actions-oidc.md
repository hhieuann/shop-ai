# ADR-0008: GitHub Actions với OIDC, không có access key

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An, Nhân

## Bối cảnh

Pipeline cần quyền deploy vào AWS. Lưu access key trong GitHub là bí mật dài hạn, lộ là mất tài khoản. Repo lại là public.

## Quyết định

- GitHub Actions nhận quyền tạm thời qua OIDC: mỗi môi trường một IAM role.
- Trust policy chỉ tin đúng repo và đúng environment, ví dụ `repo:hhieuann/shop-ai:environment:production`.
- Role deploy chỉ được assume các role mà CDK bootstrap tạo ra. Role cho PR chỉ đọc, đủ chạy `cdk diff`.

## Hệ quả

- Dễ hơn: không có key nào để lộ hay xoay vòng.
- Khó hơn: nếu chuyển repo sang organization khác thì phải sửa `sub` trong mọi trust policy.
- Hướng dẫn tạo role: [infra/README.md](../../infra/README.md).
