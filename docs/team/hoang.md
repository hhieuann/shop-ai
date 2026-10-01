# Hoàng · Fullstack, nghiệp vụ bán hàng

GitHub: [@simonhoang611](https://github.com/simonhoang611)

Bạn làm **trái tim của cửa hàng**: xem hàng, giỏ hàng, đặt hàng, quản trị, từ API tới giao diện. Đây là phần giám khảo bấm vào đầu tiên khi xem demo. Cuối dự án, phần của bạn đo bằng: khách đặt được hàng thật trên staging, không mất đơn, không trùng đơn, và E2E xanh ở mỗi lần deploy.

Bạn mới làm cloud, nên lộ trình dưới đây đi từ nền tảng lên. Không cần biết hết trước khi bắt đầu, mỗi tuần học đúng phần tuần đó cần.

## Bạn chịu trách nhiệm gì

| Khu vực | Việc cụ thể |
|---|---|
| API bán hàng | `catalog`: liệt kê theo loại, chi tiết, lọc. `cart`: thêm, sửa, xoá. `ordering`: `POST /api/v1/orders` có `Idempotency-Key`, lịch sử đơn. `admin`: thêm sản phẩm, xem đơn theo trạng thái |
| Xử lý đơn chạy nền | Worker `order-processor`: nhận đơn từ SQS, gửi email xác nhận qua SES, báo admin qua SNS. Nhận trùng message thì không gửi email hai lần |
| Thiết kế dữ liệu | Bảng `products`, `carts`, `orders`, `idempotency`: khoá và index đi từ các truy vấn cần có |
| Hợp đồng API | Các endpoint trên trong `contracts/openapi.yaml`, viết trước code |
| Giao diện web | Trang danh sách, chi tiết, giỏ, đặt hàng, lịch sử đơn, admin. An làm hai widget gợi ý và phần đăng nhập |
| E2E | Postman collection, chạy bằng Newman sau mỗi lần deploy ([hands-on-testing-guide.md](../hands-on-testing-guide.md) mục 6) |
| Runbook | `dlq-orders`, `sqs-backlog`, `dynamodb-throttle` |

## Tuần này (đến hết 05/10)

- [ ] Bật xác thực hai bước (MFA) cho tài khoản GitHub
- [ ] Cài Node 24, pnpm 12, Docker Desktop, AWS CLI v2, Postman. Clone repo, chạy `pnpm install` và `docker compose up -d`
- [ ] Đọc [git-flow.md](../git-flow.md), [hands-on-testing-guide.md](../hands-on-testing-guide.md), [ADR-0009](../adr/0009-layer-hexagonal-rut-gon.md)
- [x] Review PR #3 và #4 (đã approve ngày 01/10)
- [ ] Lab nền tảng nếu chưa làm: [000002 IAM](https://000002.awsstudygroup.com/), [000057 S3](https://000057.awsstudygroup.com/). Sau đó [000060 DynamoDB](https://000060.awsstudygroup.com/)
- [ ] Cùng nhóm viết nghiệp vụ catalog, giỏ hàng, đặt hàng vào `docs/business/` trước 05/10
- [ ] OpenAPI bản 0 cho catalog và cart
- [ ] Khung web: Vite + React + TypeScript + React Router + TanStack Query, chạy trên mock Prism
- [ ] Thiết kế bảng `products`, `carts`, `orders`: viết bảng truy vấn cần có, rồi chọn khoá; mở PR để An và Nhân góp ý
- [ ] Dự buổi đi qua module mẫu của An

## Lộ trình 8 tuần

| Tuần | Việc | Xong khi |
|---|---|---|
| 1 · 29/09–05/10 | Danh sách tuần này | Web chạy trên mock; OpenAPI bản 0 và thiết kế bảng đã merge |
| 2 · 06–12/10 | Module `catalog` theo khuôn module mẫu; script nạp khoảng 100 sản phẩm; trang danh sách và chi tiết | Xem được sản phẩm thật trên dev |
| 3 · 13–19/10 | Module `cart` và trang giỏ; Postman collection bản 1 (đăng nhập, catalog, giỏ) chạy trong CI; cùng nhóm nghiệm thu `v0.1.0` trên staging | E2E xanh; `v0.1.0` phát hành |
| 4 · 20–26/10 | Module `ordering` với `Idempotency-Key`; worker `order-processor` qua SQS, email qua SES, báo admin qua SNS; trang lịch sử đơn | Đặt hàng trọn luồng trên dev, nhận được email |
| 5 · 27/10–02/11 | Module `admin` và trang admin; integration test bằng Testcontainers cho các repository; thêm case âm vào E2E; viết runbook | Chốt tính năng cho `v0.2.0` |
| 6 · 03–09/11 | Sửa lỗi; Lighthouse ≥ 90; mẫu email; hỗ trợ An chạy load test | `v1.0.0-rc.1` |
| 7–8 · 10–23/11 | Chương workshop của mình; 3 blog; tập demo; chỉ sửa lỗi trên `release/v1.0.0` | Chương workshop xong; `v1.0.0` |

## Cần học gì, học ở đâu

| Chủ đề | Học từ | Cần khi |
|---|---|---|
| Nền tảng AWS: IAM, S3 | Lab [000002](https://000002.awsstudygroup.com/), [000057](https://000057.awsstudygroup.com/) | Tuần 1, nếu chưa làm |
| DynamoDB: khoá, GSI, Query | Lab [000060](https://000060.awsstudygroup.com/) | Tuần 1 |
| Lambda và API Gateway | Lab [000066](https://000066.awsstudygroup.com/): làm phần Lambda và API Gateway, phần SAM đọc để biết | Tuần 2 |
| SQS và SNS | Lab [000077](https://000077.awsstudygroup.com/) | Tuần 3–4 |
| Powertools for AWS Lambda (TypeScript): Logger, Idempotency, Batch | Tài liệu chính thức của Powertools | Tuần 4 |
| React Router, TanStack Query | Tài liệu chính thức | Tuần 1–2 |
| Vitest, Testcontainers, Postman và Newman | [hands-on-testing-guide.md](../hands-on-testing-guide.md) | Tuần 2–3 |

## Workshop và blog

- **Chương của bạn trong workshop nhóm:** Đơn hàng không mất khi quá tải: API Gateway → Lambda → SQS → SES
- **Blog 1 (tuần 3):** Thiết kế bảng DynamoDB bắt đầu từ truy vấn: products, carts, orders
- **Blog 2 (tuần 5):** Chống tạo đơn trùng bằng Idempotency-Key và Powertools Idempotency
- **Blog 3 (tuần 7):** Test API bằng Postman và Newman trong GitHub Actions

## Làm tốt trông như thế nào

- Luồng xem hàng → giỏ → đặt hàng → nhận email chạy thật trên staging trước 02/11
- Không truy vấn nào dùng Scan
- Bấm đặt hàng hai lần chỉ ra 1 đơn; worker nhận một message hai lần chỉ gửi 1 email
- E2E Newman xanh ở mỗi lần deploy
- Coverage của `domain` và `application` từ 80% trở lên

## Những bẫy hay gặp

- **Viết logic trong handler cho nhanh.** Khó test và khó sửa. Đặt luật vào `domain`, điều phối vào `application`.
- **Dùng Scan cho tiện.** Chậm và tốn tiền khi dữ liệu lớn. Thiết kế khoá theo truy vấn ngay từ đầu.
- **Làm giao diện trước khi chốt OpenAPI.** Dễ phải làm lại. Chốt hợp đồng trước, làm trên mock Prism.
- **PR quá to.** Cả một module trong một PR thì không ai review kỹ được. Chia theo endpoint.
- **Quên trường hợp SQS gửi lại message.** Worker phải chạy lại được mà không gửi email trùng.
- **Ngại hỏi vì mới học cloud.** Vướng quá nửa ngày thì hỏi An. Hỏi sớm rẻ hơn sửa muộn.

## Hướng đi sau dự án

- **Hướng nghề:** Fullstack developer làm serverless trên AWS. Kinh nghiệm thật với DynamoDB, Lambda, SQS và test tự động là điểm cộng lớn khi phỏng vấn fullstack hay backend.
- **Chứng chỉ:** Cloud Practitioner → **Developer – Associate**.
- **Dòng CV gợi ý:** "Xây dựng luồng bán hàng end-to-end (catalog, giỏ hàng, đặt hàng) trên AWS Lambda, DynamoDB, SQS và SES; xử lý đơn bất đồng bộ không mất đơn, không trùng đơn; viết unit test, integration test (Testcontainers) và E2E (Postman/Newman) chạy trong CI."
