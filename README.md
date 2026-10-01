# shop-ai

Shop linh kiện và thiết bị điện tử chạy serverless trên AWS, có gợi ý mua kèm bằng AI. Dự án nhóm trong kỳ thực tập First Cloud AI Journey (FCAJ), 2026.

[![PR checks](https://github.com/hhieuann/shop-ai/actions/workflows/pr.yml/badge.svg)](https://github.com/hhieuann/shop-ai/actions/workflows/pr.yml)

## Bài toán

Shop nhỏ bán linh kiện máy tính không đủ người tư vấn "mua món này thì cần thêm gì". Mua GPU thường phải nâng cấp nguồn; mua laptop thường cần chuột và túi. Dự án xây một web bán hàng có gợi ý mua kèm học từ hành vi mua sắm, chạy trên AWS với chi phí gần bằng 0 khi ít khách.

## Phạm vi MVP

- Xem, lọc, tìm sản phẩm; giỏ hàng; đặt hàng (COD hoặc thanh toán giả lập)
- Đăng ký, đăng nhập; vai trò khách hàng và admin
- Gợi ý "Dành cho bạn" và "Thường mua kèm"
- Xử lý đơn bất đồng bộ, email xác nhận
- Admin: thêm sản phẩm, xem đơn
- Giám sát, cảnh báo, CI/CD, hạ tầng bằng code

Chi tiết và phần không làm: [docs/project-plan.md](docs/project-plan.md).

## Kiến trúc

Web React tĩnh trên S3 + CloudFront có WAF. API là HTTP API + Lambda (TypeScript) + DynamoDB, đăng nhập bằng Cognito. Đơn hàng đi qua SQS, email gửi bằng SES. Gợi ý được tính theo lô (baseline hoặc Amazon Personalize) rồi ghi vào DynamoDB. Toàn bộ hạ tầng viết bằng AWS CDK.

Sơ đồ kiến trúc AWS do nhóm tự vẽ sẽ đặt ở `docs/architecture/`. Lý do cho từng lựa chọn nằm trong [docs/adr/](docs/adr/).

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| Web | React, Vite, TypeScript, TanStack Query |
| API | AWS Lambda (Node.js 24, arm64), HTTP API, Powertools for AWS Lambda |
| Dữ liệu | DynamoDB; S3 cho dữ liệu train |
| Gợi ý | Python 3.13: baseline luật mua kèm; Amazon Personalize (tuỳ chọn) |
| Hạ tầng | AWS CDK v2, cdk-nag |
| CI/CD | GitHub Actions + OIDC |
| Kiểm thử | Vitest, Testcontainers, pytest, Postman/Newman, k6, OWASP ZAP, Schemathesis |

## Cấu trúc repo

```
shop-ai/
├─ apps/web/                  React + Vite
├─ services/api/              Lambda API, chia module theo ADR-009
├─ services/workers/          Lambda chạy nền (SQS, lịch hẹn giờ)
├─ data/                      Python: sinh dữ liệu, baseline, Personalize
├─ infra/                     AWS CDK
├─ contracts/openapi.yaml     Hợp đồng API
├─ tests/                     e2e-api (Postman/Newman) · e2e-ui (Playwright) · load (k6)
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
| `pnpm deps:check` | Kiểm tra luật layer (ADR-009) |
| `docker compose up -d` | DynamoDB Local ở cổng 8000 |
| `docker compose --profile baseline up -d` | Thêm MySQL cho bản đối chứng |

## Môi trường

| Môi trường | Deploy khi | Ghi chú |
|---|---|---|
| sandbox | Chạy `cdk deploy` từ máy | Tài khoản AWS của từng người |
| dev | Merge vào `develop` | Tự động |
| staging | Push lên `release/*` | Tự động; cả nhóm test trước khi phát hành |
| prod | An đẩy tag `vX.Y.Z` | Cần 1 người khác duyệt |

Chi tiết: [infra/README.md](infra/README.md).

## Tài liệu

- [Git flow](docs/git-flow.md): nhánh, commit, PR, phát hành, hotfix, conflict
- [Hướng dẫn kiểm thử thực hành](docs/hands-on-testing-guide.md): unit, integration, E2E
- [Kế hoạch kỹ thuật](docs/engineering-plan.md): quy trình, layer, build, CI/CD, vận hành
- [Góp ý kế hoạch 30/09](docs/review-2026-09-30.md): các chỗ đã sửa trong kế hoạch ban đầu, link lab theo vai
- [Kế hoạch dự án](docs/project-plan.md): bài toán, persona, phạm vi
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
