# Việc thiết lập repo

## Đã làm khi tạo repo (30/09/2026)

- [x] Repo public `hhieuann/shop-ai`, có nhánh `main` và `develop`; `develop` là nhánh mặc định
- [x] Merge PR: chỉ bật **Create a merge commit**; tiêu đề commit merge lấy từ tiêu đề PR; tự xoá nhánh sau khi merge
- [x] Actions: quyền mặc định của `GITHUB_TOKEN` chỉ đọc; PR từ fork của người ngoài phải được duyệt mới chạy
- [x] Bảo mật: Dependabot alerts và security updates, secret scanning kèm push protection, private vulnerability reporting, CodeQL default setup
- [x] Environment `dev` chỉ nhận `develop`; `staging` chỉ nhận `release/*`; `production` chỉ nhận tag `v*`, người duyệt là An
- [x] Biến repo: `DEPLOY_ENABLED=false`, `AWS_REGION=ap-southeast-1`
- [x] Ruleset cho `develop`, `main`, `release/*`: bắt buộc PR, 1 lượt duyệt, CI xanh, chỉ merge commit, cấm force push và xoá nhánh (trừ `release/*` được xoá sau khi phát hành)
- [x] Ruleset cho tag `v*`: chỉ admin repo (An) được tạo, sửa, xoá

## An làm tiếp

1. **Mời thành viên:** Settings → Collaborators → Add people, quyền **Write** cho Hoàng và Nhân.
2. **Sau khi hai bạn nhận lời mời:**
   - Sửa `.github/CODEOWNERS`, thay `@hhieuann` ở các dòng của Hoàng và Nhân bằng username của hai bạn
   - Bật **Require review from Code Owners** trong ruleset `develop`, `main`, `release`
   - Settings → Environments → `production`: thêm Hoàng và Nhân vào người duyệt, bật **Prevent self-review**
3. **Bảng công việc:** tạo GitHub Project dạng Board, cột Backlog → Ready → In progress → In review → Done → Released.
4. **AWS:** làm theo [infra/README.md](../infra/README.md): bootstrap CDK, tạo role OIDC, đặt biến cho từng environment, rồi đổi `DEPLOY_ENABLED` thành `true`.
5. **Sau PR đầu tiên:** kiểm tra tên các check trong ruleset khớp với tên job trong `pr.yml` (`PR title`, `Node · lint, type, test, build`, `Security · secrets & dependencies`).

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
