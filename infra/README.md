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

1. IAM → Identity providers → Add provider → OpenID Connect
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. Tạo 4 role: `gh-deploy-dev`, `gh-deploy-staging`, `gh-deploy-prod`, `gh-diff-readonly`.

Trust policy của `gh-deploy-staging` (các role deploy khác chỉ đổi tên environment ở dòng `sub`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:hhieuann/shop-ai:environment:staging"
        }
      }
    }
  ]
}
```

Quyền của role deploy: chỉ được assume các role CDK bootstrap tạo ra.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::<ACCOUNT_ID>:role/cdk-hnb659fds-*-<ACCOUNT_ID>-ap-southeast-1"
    }
  ]
}
```

`gh-diff-readonly` tin `repo:hhieuann/shop-ai:pull_request` và chỉ được assume role `cdk-hnb659fds-lookup-role-<ACCOUNT_ID>-ap-southeast-1`.

Nhân review các trust policy trước khi bật deploy.

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
- Dọn dẹp cuối dự án: `cdk destroy` từng stack; xoá Personalize theo thứ tự campaign, solution, event tracker, dataset, dataset group; lên lịch xoá KMS key; hôm sau kiểm tra Billing.
