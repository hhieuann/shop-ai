# An · Trưởng nhóm, nền tảng và DevOps

GitHub: [@hhieuann](https://github.com/hhieuann)

Bạn làm cho cả nhóm **đưa được code lên cloud an toàn, rẻ và đều đặn**, và giữ cho dự án đúng hướng, đúng hạn. Cuối dự án, phần của bạn đo bằng: pipeline chạy nhanh, không có access key nào, chi phí dưới $15, và Hoàng với Nhân tự deploy được mà không cần bạn.

## Bạn chịu trách nhiệm gì

| Khu vực | Việc cụ thể |
|---|---|
| Hạ tầng (`infra/`) | Stack CDK theo môi trường; S3 + CloudFront (Origin Access Control) + WAF gói Free; HTTP API + Cognito (nhóm admin bắt buộc MFA); bảng DynamoDB theo thiết kế của Hoàng và Nhân; tag và budget |
| Pipeline (`.github/`) | 4 workflow, vai trò OIDC, biến môi trường, `DEPLOY_ENABLED` |
| Nền tảng code (`services/api/src/shared/`) | Logger, tracer, lỗi chuẩn RFC 9457, helper HTTP, cấu hình, helper idempotency. Phần cả nhóm dùng chung |
| Gợi ý trên web (`modules/recommendation`) | API `GET /api/v1/recs` đọc bảng `recs` của phiên bản đang bật, lọc hàng hết và hàng đã trong giỏ; hai widget "Dành cho bạn" và "Thường mua kèm" |
| Giám sát | Dashboard, alarm, X-Ray; runbook `api-5xx`, `lambda-throttle`, `canary-rollback`, `cost-spike` |
| Chi phí | Worker `cost-breaker`; xem Cost Explorer mỗi thứ Hai; chỉ số chi phí trên 1.000 đơn |
| Đo đạc | Bản EC2 đối chứng bằng Docker Compose; k6; canary cho `ordering`; diễn tập khôi phục |
| Phát hành | Tách nhánh `release/*`, gắn tag `v*`, chạy checklist phát hành ([git-flow.md](../git-flow.md) mục 4.4) |

## Việc của trưởng nhóm

- Lập kế hoạch sprint, giữ bảng công việc, gỡ vướng cho đồng đội
- Làm đầu mối với mentor: báo tiến độ, hỏi khi nhóm vướng
- Giữ phạm vi: việc mới phải có ADR hoặc được bạn đồng ý; bảng "không làm" trong project-plan
- Mỗi ngày lướt các PR mới vào `develop`; thấy vấn đề thì comment hoặc mở issue
- Không ôm việc: mỗi khu vực đều có người dự phòng biết cách làm

## Tuần này (đến hết 05/10)

- [x] Merge PR #3 (ADR-0009) và #4 (CODEOWNERS)
- [x] Tạo bảng GitHub Projects với các cột Backlog → Ready → In progress → In review → Done → Released (01/10)
- [x] CDK bootstrap ở tài khoản của mình (vừa là demo vừa là sandbox), cả ap-southeast-1 và us-east-1 (01/10)
- [x] Budget $20/tháng, cảnh báo ở $5, $10, $17, $20 và khi dự báo vượt $20 (01/10)
- [ ] Hướng dẫn Hoàng và Nhân bootstrap tài khoản của họ
- [x] Bật cost allocation tag `project`, `env`, `module` (08/10)
- [x] OIDC provider và 4 role theo [infra/README.md](../../infra/README.md); đặt biến; bật `DEPLOY_ENABLED=true` (01/10 và 04/10; trust policy sửa theo `sub` bất biến ở PR #25)
- [ ] Nhờ Nhân review trust policy OIDC trong `infra/bootstrap/github-oidc.yaml`
- [x] Module mẫu `GET /api/v1/products/{productId}` trong `catalog`, đủ handler, application, domain, ports, infra, kèm unit, handler và integration test theo [hands-on-testing-guide.md](../hands-on-testing-guide.md) (PR #22, 04/10). Hoàng đã làm tiếp API danh sách (PR #29, #31)
- [ ] Buổi 60 phút đi qua module mẫu với cả nhóm
- [x] Hỏi mentor 3 câu (01/10): workshop chấm theo nhóm; không dùng Personalize mà tự xây mô hình gợi ý ([ADR-0016](../adr/0016-tu-xay-mo-hinh-goi-y.md)); trọng số theo thang điểm của chương trình
- [ ] Gom nghiệp vụ của cả nhóm vào `docs/business/` trước 05/10: catalog, giỏ hàng, đặt hàng (Hoàng), tài khoản và quy mô demo (An, 08/10) đã có; còn phần gợi ý và sự kiện (Nhân)

## Lộ trình 8 tuần

| Tuần | Việc | Xong khi |
|---|---|---|
| 1 · 29/09–05/10 | Danh sách tuần này | CI xanh; ai cũng deploy được sandbox; module mẫu đã merge |
| 2 · 06–12/10 | Stack frontend, API, dữ liệu; `shared/`; dev tự deploy | Mở được web trên dev, gọi được `/api/v1/health` qua CloudFront |
| 3 · 13–19/10 | Staging; app client và người dùng cho E2E; smoke test; tách `release/v0.1.0` (16/10), tag `v0.1.0` (19/10); demo sprint 1 | `v0.1.0` chạy trên prod |
| 4 · 20–26/10 | Module recommendation và 2 widget; dashboard, alarm, runbook | Widget hiện gợi ý từ bảng `recs` trên dev |
| 5 · 27/10–02/11 | Worker `cost-breaker`; gắn rule WAF Nhân viết; X-Ray; tách `release/v0.2.0` (30/10), tag `v0.2.0` (02/11) | `v0.2.0` trên prod; alarm nào cũng có runbook |
| 6 · 03–09/11 | EC2 đối chứng và k6 ở 50/200/1.000 người ảo; canary cho ordering; diễn tập point-in-time recovery; chi phí trên 1.000 đơn; tách `release/v1.0.0` (06/11), tag `v1.0.0-rc.1` (09/11) | Có đủ số liệu cho báo cáo |
| 7–8 · 10–23/11 | Viết chính phần Proposal 8 mục; điều phối nhóm tự vẽ sơ đồ kiến trúc; ghép workshop nhóm và viết các chương của mình; tập demo 2 lần; tag `v1.0.0` (23/11) | Báo cáo đầy đủ; `v1.0.0` trên prod |
| 24–29/11 | Nộp workshop trên portal; chuẩn bị dọn tài nguyên | Đã nộp trước 29/11 |

## Cần học gì, học ở đâu

| Chủ đề | Học từ | Cần khi |
|---|---|---|
| AWS CDK v2 với TypeScript | [CDK Workshop](https://cdkworkshop.com/); lab [000038](https://000038.awsstudygroup.com/) khi trang chạy lại | Tuần 1 |
| GitHub Actions kết nối AWS bằng OIDC | Tài liệu GitHub "Configuring OpenID Connect in Amazon Web Services"; [infra/README.md](../../infra/README.md) | Tuần 1 |
| CloudFront với S3 | Lab [000094](https://000094.awsstudygroup.com/) | Tuần 2 |
| Cognito với API | Lab [000081](https://000081.awsstudygroup.com/) | Tuần 2 |
| CloudWatch: metric, alarm, dashboard | Lab [000008](https://000008.awsstudygroup.com/) | Tuần 4 |
| Docker Compose | Lab [000015](https://000015.awsstudygroup.com/) | Tuần 6 |
| k6 | [Tài liệu k6](https://grafana.com/docs/k6/latest/) | Tuần 6 |
| Deploy canary cho Lambda | Tài liệu AWS CodeDeploy cho Lambda | Tuần 6 |

## Workshop và blog

- **Workshop nhóm:** bạn điều phối và ghép bài; viết các chương Introduction, Prerequisite, hạ tầng và CI/CD (CDK, CloudFront, WAF, Cognito, GitHub OIDC) và Clean up
- **Blog 1 (tuần 3):** CI/CD không cần access key: GitHub Actions và OIDC
- **Blog 2 (tuần 5):** Một CloudFront cho cả web và API, WAF gói Free
- **Blog 3 (tuần 7):** Serverless so với container trên EC2: số liệu thật từ k6 và chi phí

## Làm tốt trông như thế nào

- Pipeline cho PR chạy dưới 10 phút; mỗi tuần deploy lên dev ít nhất 5 lần
- Không có access key nào tồn tại; mọi deploy đi qua OIDC
- Chi phí cả dự án dưới $15; không có tài nguyên bị bỏ quên
- Alarm nào cũng có runbook
- Không PR nào nằm quá 2 ngày mà không ai đọc
- Hoàng và Nhân tự deploy sandbox, tự đọc log, không cần hỏi bạn

## Những bẫy hay gặp

- **Ôm hết việc vì mình làm nhanh hơn.** Cả nhóm sẽ phụ thuộc vào một người. Hãy để đồng đội tự làm, bạn review.
- **Sửa tay trên console cho nhanh.** Hạ tầng sẽ lệch với code. Luôn sửa bằng CDK và mở PR.
- **Bật dịch vụ tính tiền theo giờ rồi quên.** Dùng cầu dao, tag, và xem Cost Explorer mỗi tuần.
- **Không ai đọc PR vì không bắt buộc duyệt.** Mỗi ngày dành 15 phút đọc PR mới của đồng đội; lỗi bắt sớm rẻ hơn lỗi đã lên dev.
- **Quyết định mà không ghi lại.** Viết một ADR ngắn, nhóm review trong 1 ngày.

## Hướng đi sau dự án

- **Hướng nghề:** Cloud, DevOps hoặc Platform engineer, vẫn giữ nền fullstack. Dự án cho bạn đủ chất liệu thật: hạ tầng bằng code, CI/CD an toàn, giám sát, quản lý chi phí, dẫn nhóm.
- **Chứng chỉ:** Cloud Practitioner (học khoá Skill Builder sau khi xong lab, như bạn đã định) → **Solutions Architect – Associate** làm mục tiêu chính sau OJT → DevOps Engineer – Professional khi có thêm kinh nghiệm.
- **Dòng CV gợi ý:** "Trưởng nhóm 3 người xây nền tảng e-commerce serverless trên AWS (CDK, Lambda, DynamoDB, CloudFront, Cognito); dựng CI/CD GitHub Actions bằng OIDC không dùng access key; deploy canary và rollback tự động; chi phí vận hành dưới $X/tháng; chịu được Y người dùng đồng thời." Thay X, Y bằng số đo được ở tuần 6.
