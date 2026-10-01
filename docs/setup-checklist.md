# Việc thiết lập repo

## Đã làm khi tạo repo (30/09/2026)

- [x] Repo public `hhieuann/shop-ai`, có nhánh `main` và `develop`; `develop` là nhánh mặc định
- [x] Merge PR: chỉ bật **Create a merge commit**; tiêu đề commit merge lấy từ tiêu đề PR; tự xoá nhánh sau khi merge
- [x] Actions: quyền mặc định của `GITHUB_TOKEN` chỉ đọc; PR từ fork của người ngoài phải được duyệt mới chạy
- [x] Bảo mật: Dependabot alerts và security updates, secret scanning kèm push protection, private vulnerability reporting, CodeQL default setup
- [x] Environment `dev` chỉ nhận `develop`; `staging` chỉ nhận `release/*`; `production` chỉ nhận tag `v*`, người duyệt là An, Hoàng, Nhân, bật **Prevent self-review**
- [x] Biến repo: `DEPLOY_ENABLED=false`, `AWS_REGION=ap-southeast-1`
- [x] Ruleset cho `develop`, `main`, `release/*`: bắt buộc PR, CI xanh, chỉ merge commit, cấm force push và xoá nhánh (trừ `release/*` được xoá sau khi phát hành). `main` và `release/*` cần 1 lượt duyệt; `develop` không cần (đổi ngày 01/10)
- [x] Ruleset cho tag `v*`: chỉ admin repo (An) được tạo, sửa, xoá

## Đã làm sau đó (01/10/2026)

- [x] Hoàng (@simonhoang611) và Nhân (@Netanii) vào repo với quyền **Write**
- [x] `.github/CODEOWNERS` có người phụ trách chính và người dự phòng cho từng khu vực. Chỉ dùng để tự mời người xem PR; không bật **Require review from Code Owners**
- [x] Tên check trong ruleset khớp tên job trong `pr.yml`

## An làm tiếp

1. **Bảng công việc:** tạo GitHub Project dạng Board, cột Backlog → Ready → In progress → In review → Done → Released.
2. **AWS:** làm theo [infra/README.md](../infra/README.md): bootstrap CDK, tạo role OIDC, đặt biến cho từng environment. Chỉ đổi `DEPLOY_ENABLED` thành `true` khi `infra/` đã có app CDK, nếu không `deploy.yml` sẽ lỗi.

## Mỗi thành viên làm một lần

```bash
git clone https://github.com/hhieuann/shop-ai.git
cd shop-ai
git checkout develop
npm install -g pnpm@12
pnpm install
docker compose up -d
```

- Cài Docker Desktop (WSL2), Postman, AWS CLI v2
- Đọc [git-flow.md](git-flow.md) và [hands-on-testing-guide.md](hands-on-testing-guide.md)
- Bật MFA cho tài khoản GitHub
