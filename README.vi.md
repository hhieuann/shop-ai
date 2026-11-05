# shop-ai

[English](README.md) | **Tiếng Việt**

Shop linh kiện và thiết bị điện tử chạy serverless trên AWS, có gợi ý "thường mua kèm" và "dành cho bạn" bằng mô hình nhóm tự xây. Dự án nhóm trong kỳ thực tập First Cloud AI Journey (FCAJ), 2026.

[![Deploy dev](https://github.com/hhieuann/shop-ai/actions/workflows/deploy.yml/badge.svg?branch=develop)](https://github.com/hhieuann/shop-ai/actions/workflows/deploy.yml?query=branch%3Adevelop)

**Bản demo (v0.1.0):** https://d1e2x1capwqhry.cloudfront.net. Đây là shop demo: không có đơn hàng, thanh toán hay giao hàng thật.

## Bài toán

Shop nhỏ bán linh kiện máy tính không đủ người tư vấn "mua món này thì cần thêm gì". Mua GPU thường phải nâng cấp nguồn; mua laptop thường cần chuột và túi. Dự án xây một web bán hàng có gợi ý mua kèm học từ hành vi mua sắm, chạy trên AWS với chi phí gần bằng 0 khi ít khách.

## Tình trạng dự án

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| **v0.1.0** (đã phát hành) | 22/10/2026 | Xem, lọc, tìm sản phẩm; đăng ký, đăng nhập; giỏ khách và giỏ tài khoản, gộp giỏ khi đăng nhập; giám sát gồm alarm, dashboard, runbook. Cả nhóm nghiệm thu trên staging rồi mới deploy prod. [Release note](https://github.com/hhieuann/shop-ai/releases/tag/v0.1.0) |
| v0.2.0 (đang làm) | dự kiến 02/11/2026 | Đặt hàng xử lý bất đồng bộ, email xác nhận; ghi sự kiện hành vi; pipeline gợi ý mỗi đêm và các widget gợi ý |
| Sau đó | 11/2026 | Trang admin, WAF và header bảo mật, kiểm thử tải và bảo mật |

## Dự án thể hiện được gì

- **Hạ tầng bằng code:** mọi tài nguyên AWS viết bằng AWS CDK (TypeScript), cdk-nag kiểm ở mỗi pull request.
- **CI/CD không cần access key:** GitHub Actions deploy qua role OIDC, không lưu access key AWS ở đâu cả. Bốn môi trường (sandbox, dev, staging, prod); prod cần một thành viên khác duyệt, mỗi lần deploy đều chạy smoke test và E2E API.
- **Vận hành:** alarm CloudWatch gửi email cho nhóm, dashboard cho từng môi trường, runbook viết sẵn và diễn tập alarm. Một alarm thật trên staging (Lambda timeout khi khởi động lạnh) đã được lần theo log và sửa trước khi phát hành.
- **Bảo mật từ thiết kế:** threat model viết thành văn bản, quyền IAM tối thiểu cho từng module, dữ liệu hành vi ẩn danh bằng HMAC, quét secret, kiểm thư viện có lỗ hổng và CodeQL trong CI.
- **Quy trình nhóm:** Git flow có bảo vệ nhánh, commit theo chuẩn, CODEOWNERS, ADR cho mỗi quyết định lớn, checklist phát hành có nghiệm thu.

## Kiến trúc

Web React tĩnh trên S3 + CloudFront. API là HTTP API + Lambda (TypeScript) + DynamoDB, đăng nhập bằng Cognito. Đơn hàng đi qua SQS, email gửi bằng SES. Gợi ý do mô hình nhóm tự xây (luật mua kèm, gợi ý theo món tương tự) tính mỗi đêm rồi ghi vào DynamoDB. WAF trước CloudFront làm trong tháng 11.

Sơ đồ kiến trúc AWS do nhóm tự vẽ sẽ đặt ở `docs/architecture/`. Lý do cho từng lựa chọn nằm trong [docs/adr/](docs/adr/).

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| Web | React, Vite, TypeScript, TanStack Query |
| API | AWS Lambda (Node.js 24, arm64), HTTP API, Powertools for AWS Lambda |
| Dữ liệu | DynamoDB; S3 cho dữ liệu train |
| Gợi ý | Python 3.13: luật mua kèm, gợi ý theo món tương tự; chạy mỗi đêm trên Lambda bằng EventBridge Scheduler (đang làm) |
| Hạ tầng | AWS CDK v2, cdk-nag |
| CI/CD | GitHub Actions + OIDC |
| Kiểm thử | Vitest (cả E2E API), Testcontainers, pytest, k6, OWASP ZAP, Schemathesis |

## Cấu trúc repo

```
shop-ai/
├─ apps/web/                  React + Vite
├─ services/api/              Lambda API, chia module theo ADR-0009
├─ services/workers/          Lambda chạy nền (SQS, lịch hẹn giờ)
├─ data/                      Python: sinh dữ liệu, mô hình gợi ý, pipeline mỗi đêm
├─ infra/                     AWS CDK
├─ contracts/openapi.yaml     Hợp đồng API
├─ tests/                     smoke · e2e-api (Vitest) · e2e-ui (Playwright) · load (k6)
├─ docs/                      Kế hoạch, ADR, nghiệp vụ, runbook, workshop
└─ .github/                   Workflow, mẫu PR và issue, CODEOWNERS
```

## Bắt đầu

### Cài công cụ

- Node.js 24 (xem `.nvmrc`)
- pnpm 12: `npm install -g pnpm@12`
- Docker Desktop (Windows chạy trên WSL2)
- AWS CLI v2; CDK chạy qua `pnpm exec cdk`, không cần cài riêng
- uv, nếu làm phần `data/`

### Lần đầu

```bash
git clone https://github.com/hhieuann/shop-ai.git
cd shop-ai
git checkout develop
pnpm install
docker compose up -d
```

`pnpm install` cài luôn git hook: định dạng code khi commit và kiểm tra commit message.

### Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` | Chạy trên mọi package |
| `pnpm format` | Định dạng toàn repo |
| `pnpm deps:check` | Kiểm tra luật layer (ADR-0009) |
| `docker compose up -d` | DynamoDB Local ở cổng 8000 |
| `docker compose --profile baseline up -d` | Thêm MySQL cho bản đối chứng |

## Môi trường

| Môi trường | Deploy khi | Ghi chú |
|---|---|---|
| sandbox | Chạy `cdk deploy` từ máy | Tài khoản AWS của từng người |
| dev | Merge vào `develop` | Tự động |
| staging | Push lên `release/*` | Tự động; cả nhóm test trước khi phát hành |
| prod | Đẩy tag `vX.Y.Z` | Cần 1 người khác duyệt |

Chi tiết: [infra/README.md](infra/README.md).

## Tài liệu

- [Git flow](docs/git-flow.md): nhánh, commit, PR, phát hành, hotfix, conflict
- [Hướng dẫn kiểm thử thực hành](docs/hands-on-testing-guide.md): unit, integration, E2E
- [Kế hoạch kỹ thuật](docs/engineering-plan.md): quy trình, layer, build, CI/CD, vận hành
- [Góp ý kế hoạch 30/09](docs/review-2026-09-30.md): các chỗ đã sửa trong kế hoạch ban đầu, link lab theo vai
- [Kế hoạch dự án](docs/project-plan.md): bài toán, persona, phạm vi
- [Threat model](docs/security/threat-model.md)
- [Checklist phát hành v0.1.0](docs/releases/v0.1.0.md): các bước nghiệm thu và kết quả
- [ADR](docs/adr/) · [Nghiệp vụ](docs/business/) · [Runbook](docs/runbooks/) · [Workshop FCAJ](docs/workshop/)
- [Việc thiết lập repo](docs/setup-checklist.md)
- [Cách đóng góp](CONTRIBUTING.md)

## Nhóm

| Thành viên | GitHub | Vai trò |
|---|---|---|
| An | [@hhieuann](https://github.com/hhieuann) | Trưởng nhóm · nền tảng, DevOps, bảo mật hạ tầng |
| Hoàng | [@simonhoang611](https://github.com/simonhoang611) | Fullstack · nghiệp vụ bán hàng |
| Nhân | [@Netanii](https://github.com/Netanii) | Dữ liệu, gợi ý · bảo mật dữ liệu và AI |

Việc cần làm và lộ trình của từng người: [docs/team/](docs/team/).

## Bảo mật

Phát hiện lỗ hổng: đọc [SECURITY.md](SECURITY.md). Đừng mở issue công khai.

## Giấy phép

MIT. Xem [LICENSE](LICENSE).
