# Architecture Decision Records

Mỗi quyết định kiến trúc quan trọng được ghi thành một file: chọn gì, vì sao, đánh đổi gì. ADR-001 đến ADR-003 nằm trong [project-plan.md](../project-plan.md).

| ADR | Quyết định | Trạng thái |
|---|---|---|
| [0004](0004-goi-y-batch-truoc.md) | Gợi ý chạy batch mỗi đêm; bảng `recs` | Chấp nhận; phần Personalize thay bởi 0016 |
| [0005](0005-lambda-ngoai-vpc.md) | Lambda không đặt trong VPC, không NAT gateway | Chấp nhận |
| [0006](0006-mot-cloudfront-waf.md) | Một CloudFront cho web và `/api/*`, WAF gói Free | Chấp nhận |
| [0007](0007-http-api-jwt-cognito.md) | HTTP API + JWT authorizer của Cognito | Chấp nhận |
| [0008](0008-github-actions-oidc.md) | GitHub Actions + OIDC, không có access key | Chấp nhận |
| [0009](0009-layer-hexagonal-rut-gon.md) | Modular monolith, mỗi module một Lambda; bên trong mỗi module là Hexagonal rút gọn | Chấp nhận |
| [0010](0010-git-flow.md) | Git flow có nhánh release cho mỗi lần phát hành, merge commit, tag thủ công | Chấp nhận |
| [0011](0011-monorepo-openapi.md) | Monorepo pnpm; OpenAPI là nguồn sự thật của API | Chấp nhận |
| [0012](0012-dynamodb-moi-module-mot-bang.md) | DynamoDB mỗi module một bảng | Chấp nhận |
| [0013](0013-moi-truong-chung-tai-khoan.md) | dev, staging, prod chung tài khoản demo, tách bằng stack | Chấp nhận |
| [0014](0014-canary-ordering.md) | Deploy Lambda ordering kiểu canary bằng CodeDeploy | Đề xuất |
| [0015](0015-repo-public.md) | Repo public | Chấp nhận |
| [0016](0016-tu-xay-mo-hinh-goi-y.md) | Tự xây mô hình gợi ý trên Lambda + DynamoDB, không dùng Personalize | Chấp nhận |

## Mẫu cho ADR mới

Tạo file `NNNN-ten-ngan.md`, thêm một dòng vào bảng trên, mở PR để cả nhóm review.

```markdown
# ADR-NNNN: Tiêu đề

- Trạng thái: Đề xuất | Chấp nhận | Thay thế bởi ADR-XXXX
- Ngày: dd/mm/yyyy
- Người quyết: ...

## Bối cảnh
Tình huống là gì, ràng buộc nào đang có.

## Quyết định
Chọn gì.

## Các lựa chọn đã cân nhắc
| Lựa chọn | Độ phức tạp | Chi phí | Hợp với nhóm |
|---|---|---|---|

## Hệ quả
- Dễ hơn: ...
- Khó hơn: ...
- Cần xem lại khi: ...
```
