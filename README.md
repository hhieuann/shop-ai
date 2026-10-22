# shop-ai

**English** | [Tiếng Việt](README.vi.md)

A serverless e-commerce shop for PC components and electronics on AWS, with "frequently bought together" and "for you" recommendations from a model the team built itself. Team project for the First Cloud AI Journey (FCAJ) internship, 2026.

[![PR checks](https://github.com/hhieuann/shop-ai/actions/workflows/pr.yml/badge.svg)](https://github.com/hhieuann/shop-ai/actions/workflows/pr.yml)

**Live demo (v0.1.0):** https://d1e2x1capwqhry.cloudfront.net. This is a demo shop: no real orders, payments or deliveries.

## The problem

Small PC component shops do not have enough staff to answer "if I buy this, what else do I need?". A new GPU often needs a bigger power supply; a laptop usually needs a mouse and a bag. This project builds a web shop that recommends add-ons learned from shopping behaviour, running on AWS at close to zero cost while traffic is low.

## Project status

| Version | Date | Contents |
|---|---|---|
| **v0.1.0** (released) | 22 Oct 2026 | Browse, filter and search products; sign up and sign in; guest cart and account cart, merged on sign-in; monitoring with alarms, dashboard and runbooks. Accepted by the team on staging, then deployed to production. [Release notes](https://github.com/hhieuann/shop-ai/releases/tag/v0.1.0) |
| v0.2.0 (in progress) | planned 2 Nov 2026 | Ordering with asynchronous processing and email confirmation; behaviour events; nightly recommendation pipeline and the recommendation widgets |
| Later | Nov 2026 | Admin pages, WAF and security headers, load and security testing |

## What this project demonstrates

- **Infrastructure as code:** every AWS resource is defined in AWS CDK (TypeScript) and checked by cdk-nag on every pull request.
- **CI/CD without long-lived keys:** GitHub Actions deploys through OIDC roles, with no AWS access keys stored anywhere. Four environments (sandbox, dev, staging, prod); production needs approval from another team member, and every deploy runs smoke tests and API end-to-end tests.
- **Operations:** CloudWatch alarms that email the team, a dashboard per environment, written runbooks, and alarm drills. A real staging alarm (a Lambda timeout on cold start) was traced through the logs and fixed before release.
- **Security by design:** a written threat model, least-privilege IAM per module, anonymised behaviour data (HMAC), secret scanning, dependency auditing and CodeQL in CI.
- **Team process:** Git flow with protected branches, conventional commits, code owners, Architecture Decision Records for every major choice, and a release checklist with acceptance testing.

## Architecture

A static React web app on S3 + CloudFront. The API is an HTTP API with Lambda (TypeScript) and DynamoDB, with sign-in through Amazon Cognito. Orders go through SQS and confirmation emails through SES. Recommendations come from models the team built (association rules and item-based collaborative filtering), computed nightly and written to DynamoDB. WAF in front of CloudFront is planned for November.

The AWS architecture diagram, drawn by the team, will be placed in `docs/architecture/`. The reasons for each choice are in [docs/adr/](docs/adr/).

## Tech stack

| Layer | Technology |
|---|---|
| Web | React, Vite, TypeScript, TanStack Query |
| API | AWS Lambda (Node.js 24, arm64), API Gateway HTTP API, Powertools for AWS Lambda |
| Data | DynamoDB; S3 for training data |
| Recommendations | Python 3.13: association rules, item-based collaborative filtering; nightly run on Lambda with EventBridge Scheduler (in progress) |
| Infrastructure | AWS CDK v2, cdk-nag |
| CI/CD | GitHub Actions + OIDC |
| Testing | Vitest (including API E2E), Testcontainers, pytest, k6, OWASP ZAP, Schemathesis |

## Repository layout

```
shop-ai/
├─ apps/web/                  React + Vite
├─ services/api/              Lambda API, one module per business area (ADR-0009)
├─ services/workers/          Background Lambdas (SQS, schedules)
├─ data/                      Python: data generator, recommendation models, nightly pipeline
├─ infra/                     AWS CDK
├─ contracts/openapi.yaml     API contract
├─ tests/                     smoke · e2e-api (Vitest) · e2e-ui (Playwright) · load (k6)
├─ docs/                      Plans, ADRs, business rules, runbooks, workshop
└─ .github/                   Workflows, PR and issue templates, CODEOWNERS
```

## Getting started

### Tools

- Node.js 24 (see `.nvmrc`)
- pnpm 12: `npm install -g pnpm@12`
- Docker Desktop (on Windows, with WSL2)
- AWS CLI v2; CDK runs through `pnpm exec cdk`, no separate install needed
- uv, for the `data/` folder

### First run

```bash
git clone https://github.com/hhieuann/shop-ai.git
cd shop-ai
git checkout develop
pnpm install
docker compose up -d
```

`pnpm install` also installs the git hooks: code is formatted on commit and commit messages are checked.

### Common commands

| Command | What it does |
|---|---|
| `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` | Run on every package |
| `pnpm format` | Format the whole repo |
| `pnpm deps:check` | Check the layer rules (ADR-0009) |
| `docker compose up -d` | DynamoDB Local on port 8000 |
| `docker compose --profile baseline up -d` | Add MySQL for the comparison baseline |

## Environments

| Environment | Deployed when | Notes |
|---|---|---|
| sandbox | `cdk deploy` from a laptop | Each member's own AWS account |
| dev | Merge into `develop` | Automatic |
| staging | Push to `release/*` | Automatic; the team tests here before a release |
| prod | A `vX.Y.Z` tag is pushed | Needs approval from another member |

Details: [infra/README.md](infra/README.md).

## Documentation

Most documents are written in Vietnamese, the team's working language.

- [Git flow](docs/git-flow.md): branches, commits, PRs, releases, hotfixes, conflicts
- [Hands-on testing guide](docs/hands-on-testing-guide.md): unit, integration, E2E
- [Engineering plan](docs/engineering-plan.md): process, layers, build, CI/CD, operations
- [Project plan](docs/project-plan.md): problem, personas, scope
- [Threat model](docs/security/threat-model.md)
- [v0.1.0 release checklist](docs/releases/v0.1.0.md): acceptance tests and results
- [ADRs](docs/adr/) · [Business rules](docs/business/) · [Runbooks](docs/runbooks/) · [FCAJ workshop](docs/workshop/)
- [Repository setup](docs/setup-checklist.md)
- [Contributing](CONTRIBUTING.md)

## Team

| Member | GitHub | Role |
|---|---|---|
| An | [@hhieuann](https://github.com/hhieuann) | Team lead · platform, DevOps, infrastructure security |
| Hoàng | [@simonhoang611](https://github.com/simonhoang611) | Full-stack · shopping features |
| Nhân | [@Netanii](https://github.com/Netanii) | Data and recommendations · data and AI security |

Each member's tasks and roadmap: [docs/team/](docs/team/).

## Security

Found a vulnerability? Read [SECURITY.md](SECURITY.md). Please do not open a public issue.

## License

MIT. See [LICENSE](LICENSE).
