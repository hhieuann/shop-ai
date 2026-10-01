# infra

Hạ tầng viết bằng AWS CDK v2 (TypeScript). An phụ trách.

## Stack và môi trường

| Môi trường | Tài khoản | Tên stack | Deploy bằng |
|---|---|---|---|
| sandbox | Tài khoản của từng người | `shop-sbx-<tên>` | `cdk deploy` hoặc `cdk watch --hotswap` từ máy |
| dev | Tài khoản demo | `shop-dev` | `deploy.yml` khi merge vào `develop` |
| staging | Tài khoản demo | `shop-stg` | `deploy.yml` khi push `release/*` |
| prod | Tài khoản demo | `shop-prd` | `deploy-prod.yml` khi có tag `v*` |

Mọi tài nguyên gắn tag `project=shop-ai`, `env`, `owner`, `module` ở cấp CDK app. Region: `ap-southeast-1`.

## Script mà workflow cần trong `infra/package.json`

| Script | Làm gì |
|---|---|
| `synth` | `cdk synth` cho mọi môi trường; cdk-nag chạy trong bước này |
| `diff:staging` | `cdk diff` so với staging |
| `deploy:dev` · `deploy:staging` · `deploy:prod` | `cdk deploy --all --require-approval never -c env=<môi trường>` |

Tên package phải là `infra` để lệnh `pnpm --filter infra` chạy được.

## Làm một lần cho mỗi tài khoản

```bash
pnpm exec cdk bootstrap aws://<ACCOUNT_ID>/ap-southeast-1
```

Rồi tạo AWS Budgets $5, $10, $20 và bật cost allocation tag `project` trong Billing.

## Kết nối GitHub Actions với AWS bằng OIDC (tài khoản demo)

OIDC provider và 4 role nằm trong [bootstrap/github-oidc.yaml](bootstrap/github-oidc.yaml). Muốn đổi trust policy thì sửa file này qua PR; Nhân review trước khi bật deploy.

| Role | Ai assume được | Được làm gì |
|---|---|---|
| `gh-deploy-dev` | Job có `environment: dev` của repo này | Assume các role CDK bootstrap ở ap-southeast-1 và us-east-1 |
| `gh-deploy-staging` | Job có `environment: staging` | Như trên |
| `gh-deploy-prod` | Job có `environment: production` | Như trên |
| `gh-diff-readonly` | Job chạy trên `pull_request` | Chỉ assume role lookup của CDK, chỉ đọc |

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
