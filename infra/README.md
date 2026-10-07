# infra

Hạ tầng viết bằng AWS CDK v2 (TypeScript). An phụ trách.

## Stack và môi trường

| Môi trường | Tài khoản | Tiền tố stack | Deploy bằng |
|---|---|---|---|
| sandbox | Tài khoản của từng người | `shop-sbx-<tên>` | Lệnh `cdk deploy` từ máy |
| dev | Tài khoản demo | `shop-dev` | `deploy.yml` khi merge vào `develop` |
| staging | Tài khoản demo | `shop-stg` | `deploy.yml` khi push `release/*` |
| prod | Tài khoản demo | `shop-prd` | `deploy-prod.yml` khi có tag `v*` |

Mỗi môi trường có các stack mang tiền tố trên, hiện có `<tiền tố>-api` (vd. `shop-dev-api`): bảng DynamoDB, Lambda theo module, HTTP API. Trừ prod, stack này còn có custom resource `SeedProducts` nạp 104 sản phẩm demo (`services/api/seed/catalog/products.json`) vào bảng `products` ở mỗi lần deploy mà file đó đổi. Mọi tài nguyên gắn tag `project=shop-ai`, `env`; tài nguyên của module gắn thêm `module`. Region: `ap-southeast-1`.

## Cấu trúc

```text
infra/
├─ bin/shop.ts        đọc -c env, tạo stack, bật cdk-nag
├─ lib/config.ts      tên môi trường → tiền tố stack
├─ lib/api-stack.ts   bảng products, Lambda catalog, HTTP API
└─ test/              unit test bằng aws-cdk-lib/assertions
```

## Lệnh thường dùng

Chạy ở thư mục gốc repo, sau khi `aws login`. Lệnh nào cũng phải có `-c env=...`; thiếu thì CDK dừng ngay để không deploy nhầm môi trường.

| Việc | Lệnh |
|---|---|
| Synth và kiểm cdk-nag, giống CI | `pnpm --filter infra run synth` |
| Unit test cho stack | `pnpm --filter infra run test` |
| Xem thay đổi trước khi deploy sandbox | `pnpm --filter infra exec cdk diff -c env=sbx -c owner=<tên>` |
| Deploy sandbox của mình | `pnpm --filter infra exec cdk deploy -c env=sbx -c owner=<tên>` |
| Xoá sandbox | `pnpm --filter infra exec cdk destroy -c env=sbx -c owner=<tên>` |

Script `deploy:dev`, `deploy:staging`, `deploy:prod`, `diff:staging` dành cho workflow, không chạy từ máy. CDK CLI được ghim phiên bản trong `infra/package.json`; luôn gọi qua `pnpm --filter infra exec cdk`, không dùng `npx aws-cdk@latest`.

cdk-nag chạy ở mỗi lần synth và chặn khi còn lỗi. Lỗi nào có lý do chính đáng thì ghi nhận ngay cạnh tài nguyên bằng `Validations.of(construct).acknowledge({ id, reason })`, không tắt cả luật. Danh sách lỗi đã ghi nhận nằm trong `cdk.out/validation-report.json`.

## Làm một lần cho mỗi tài khoản

```bash
pnpm --filter infra exec cdk bootstrap aws://<ACCOUNT_ID>/ap-southeast-1 aws://<ACCOUNT_ID>/us-east-1 --termination-protection
```

`us-east-1` cần cho WAF gắn vào CloudFront. Rồi tạo AWS Budgets $5, $10, $20, và sau lần deploy đầu tiên thì bật cost allocation tag `project` trong Billing.

## Kết nối GitHub Actions với AWS bằng OIDC (tài khoản demo)

OIDC provider và 4 role nằm trong [bootstrap/github-oidc.yaml](bootstrap/github-oidc.yaml). Muốn đổi trust policy thì sửa file này qua PR; Nhân review trước khi bật deploy.

| Role | Ai assume được | Được làm gì |
|---|---|---|
| `gh-deploy-dev` | Job có `environment: dev` của repo này | Assume các role CDK bootstrap ở ap-southeast-1 và us-east-1 |
| `gh-deploy-staging` | Job có `environment: staging` | Như trên |
| `gh-deploy-prod` | Job có `environment: production` | Như trên |
| `gh-diff-readonly` | Job chạy trên `pull_request` | Chỉ assume role lookup của CDK, chỉ đọc |

Trust policy so khớp trường `sub` trong token theo định dạng có mã số bất biến, mặc định cho repo tạo sau 15/07/2026: `repo:hhieuann@194261813/shop-ai@1398388653:environment:dev`. Xem tiền tố của repo bằng `gh api repos/hhieuann/shop-ai/actions/oidc/customization/sub --jq .sub_claim_prefix`.

Deploy lần đầu hoặc sau khi sửa template, chạy ở thư mục gốc repo sau khi `aws login`:

```bash
aws cloudformation deploy --stack-name shop-github-oidc --template-file infra/bootstrap/github-oidc.yaml --capabilities CAPABILITY_NAMED_IAM --region ap-southeast-1 --tags project=shop-ai
```

Bật chống xoá cho stack, chỉ cần một lần:

```bash
aws cloudformation update-termination-protection --enable-termination-protection --stack-name shop-github-oidc --region ap-southeast-1
```

Xem ARN của các role để đặt biến trên GitHub:

```bash
aws cloudformation describe-stacks --stack-name shop-github-oidc --region ap-southeast-1 --query "Stacks[0].Outputs" --output table
```

## Biến và secret trên GitHub

| Ở đâu | Tên | Giá trị |
|---|---|---|
| Repo variable | `DEPLOY_ENABLED` | `false` tới khi xong phần OIDC, sau đó `true` |
| Repo variable | `AWS_REGION` | `ap-southeast-1` |
| Repo variable | `AWS_DIFF_ROLE_ARN` | ARN của `gh-diff-readonly` |
| Repo variable | `STAGING_URL` | URL CloudFront của staging, cho `nightly.yml` |
| Environment `dev`, `staging`, `production` | `AWS_DEPLOY_ROLE_ARN` | ARN role deploy của môi trường đó |
| Environment `dev`, `staging`, `production` | `BASE_URL` | URL CloudFront của môi trường đó |
| Environment `dev`, `staging` | `E2E_COGNITO_CLIENT_ID`, `E2E_USERNAME` | App client và người dùng dành cho E2E |
| Environment `dev`, `staging` | secret `E2E_PASSWORD` | Mật khẩu người dùng E2E |

## Quy tắc

- Không sửa tài nguyên trên console ở dev, staging, prod. Muốn đổi thì sửa code CDK và mở PR.
- Lambda không đặt trong VPC, không tạo NAT gateway (ADR-0005).
- Bảng dữ liệu ở prod để `RemovalPolicy.RETAIN`; ở sandbox, dev, staging để `DESTROY`.
- Dọn dẹp cuối dự án: `cdk destroy` từng stack; lên lịch xoá KMS key; hôm sau kiểm tra Billing.

## Lỗi đã gặp

### Đổi tên biến trong đường dẫn route: `ConflictException`

Đổi `GET /api/v1/products/{id}` thành `{productId}` trên một HTTP API đã deploy thì `cdk deploy` báo `has a conflicting variable on the same hierarchical level` rồi rollback. Tên biến nằm trong ID của route, nên CloudFormation coi đó là route mới: nó tạo route mới trước, xoá route cũ sau cùng. API Gateway không cho 2 route khác tên biến ở cùng một cấp, nên bước tạo thất bại.

- Ở sandbox: chạy `cdk destroy` rồi deploy lại.
- Ở dev, staging, prod: deploy 2 lần, lần đầu bỏ route cũ, lần sau thêm route mới.
- Đổi đường dẫn cũng là đổi hợp đồng API: sửa `contracts/openapi.yaml` trước và báo cả nhóm.

### Workflow deploy báo `Not authorized to perform sts:AssumeRoleWithWebIdentity`

Trường `sub` trong token GitHub không khớp trust policy. Repo tạo sau 15/07/2026 dùng định dạng có mã số bất biến (`repo:hhieuann@194261813/shop-ai@1398388653:...`), trong khi trust policy cũ chờ `repo:hhieuann/shop-ai:...`. Xem `sub` thật trong CloudTrail: sự kiện `AssumeRoleWithWebIdentity`, trường `userIdentity.userName`. Sửa `infra/bootstrap/github-oidc.yaml` rồi deploy lại stack `shop-github-oidc`.
