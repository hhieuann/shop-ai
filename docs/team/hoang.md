# Hoàng · Fullstack, nghiệp vụ bán hàng

GitHub: [@simonhoang611](https://github.com/simonhoang611)

Bạn làm **trái tim của cửa hàng**: xem hàng, giỏ hàng, đặt hàng, quản trị, từ API tới giao diện. Đây là phần giám khảo bấm vào đầu tiên khi xem demo. Cuối dự án, phần của bạn đo bằng: khách đặt được hàng thật trên staging, không mất đơn, không trùng đơn, và E2E xanh ở mỗi lần deploy.

Bạn mới làm cloud, nên lộ trình dưới đây đi từ nền tảng lên. Không cần biết hết trước khi bắt đầu, mỗi tuần học đúng phần tuần đó cần.

## Bạn chịu trách nhiệm gì

| Khu vực | Việc cụ thể |
|---|---|
| API bán hàng | `catalog`: liệt kê theo loại, chi tiết, lọc. `cart`: thêm, sửa, xoá, gộp giỏ khách. `ordering`: `POST /api/v1/orders` có `Idempotency-Key`, lịch sử đơn, huỷ đơn. Admin (bản rc.1): xem đơn theo trạng thái và chuyển `SHIPPED`, `DELIVERED` (ordering.md BR-15); thêm sản phẩm, admin huỷ đơn để sau rc.1 |
| Xử lý đơn chạy nền | Worker `order-processor`: nhận đơn từ SQS, xác nhận đơn, gửi tin `order-confirmed` qua SNS (chỉ hàng đợi của module `events` nghe), gửi email xác nhận và email huỷ qua SES. Nhận trùng message thì không gửi email hai lần |
| Thiết kế dữ liệu | Bảng `products`, `carts`, `orders`, `cart-idempotency`, `order-idempotency`: khoá và index đi từ các truy vấn cần có |
| Hợp đồng API | Các endpoint trên trong `contracts/openapi.yaml`, viết trước code |
| Giao diện web | Trang danh sách, chi tiết, giỏ, đặt hàng, lịch sử đơn, admin. An làm hai widget gợi ý và phần đăng nhập |
| E2E | E2E API bằng Vitest + fetch, chạy sau mỗi lần deploy ([hands-on-testing-guide.md](../hands-on-testing-guide.md) mục 6, [ADR-0018](../adr/0018-e2e-api-bang-vitest.md)) |
| Runbook | `dlq-orders`, `sqs-backlog`, `dynamodb-throttle` (đã có cả ba) |

## Tình trạng (08/11)

Đã xong, theo PR chính:

- [x] Nghiệp vụ, thiết kế bảng, OpenAPI bản 0, khung web (PR #15, #17, #19, #21)
- [x] Catalog và 104 sản phẩm demo tự nạp khi deploy (PR #22, #29, #31, #44, #60)
- [x] Giỏ hàng, giỏ khách vãng lai và gộp giỏ khi đăng nhập (PR #56, #58, #94, #97)
- [x] Giao diện chàm: header, trang chủ, danh sách, giỏ, đặt hàng (PR #121, #123, #125, #144–#158)
- [x] E2E API bằng Vitest chạy sau mỗi lần deploy (PR #164, #257)
- [x] Đặt hàng có `Idempotency-Key`, tối đa 3 đơn đang mở, xem và huỷ đơn (PR #233, #242, #247, #248, #255, #256)
- [x] Worker `order-processor`: xác nhận đơn, tin `order-confirmed`, email SES (PR #259, #263, #265, #284)
- [x] Trang chi tiết sản phẩm làm lại, web gửi sự kiện xem hàng và thêm giỏ (PR #330, #331, #332, #338, #340, #341, #344, #345, #347)
- [x] Hiệu năng trên điện thoại đạt mốc Lighthouse 90 theo cách đo mới; số trên icon giỏ và hiệu ứng thêm vào giỏ (PR #355, #362, #369)
- [x] Admin chuyển đơn sang `SHIPPED`, `DELIVERED`: API, hạ tầng, màn hình `/admin` (PR #385, #387, #389)
- [x] Runbook `dlq-orders`, `sqs-backlog`, `dynamodb-throttle` (PR #234, #263, #391)

Còn lại:

- [ ] Nghiệm thu `v1.0.0-rc.1` trên staging ngày 10–11/11: R1, R2, R3 (đặt, xem, huỷ đơn; đơn thứ 4; khối gợi ý) và P1 (Lighthouse), theo [releases/v1.0.0-rc.1.md](../releases/v1.0.0-rc.1.md)
- [ ] Chương workshop và blog (tuần 7–8)

## Lộ trình 8 tuần

| Tuần | Việc | Xong khi |
|---|---|---|
| 1 · 29/09–05/10 | Nghiệp vụ, OpenAPI bản 0, thiết kế bảng, khung web | Web chạy trên mock; OpenAPI bản 0 và thiết kế bảng đã merge |
| 2 · 06–12/10 | Module `catalog` theo khuôn module mẫu; script nạp khoảng 100 sản phẩm; trang danh sách và chi tiết | Xem được sản phẩm thật trên dev |
| 3 · 13–19/10 | Module `cart` và trang giỏ; E2E API bản 1 (đăng nhập, catalog, giỏ, ca lỗi) chạy trong CI; cùng nhóm nghiệm thu `v0.1.0` trên staging | E2E xanh; `v0.1.0` phát hành |
| 4 · 20–26/10 | Module `ordering` với `Idempotency-Key`; worker `order-processor` qua SQS, email qua SES, tin `order-confirmed` qua SNS; trang lịch sử đơn | Đặt hàng trọn luồng trên dev, nhận được email |
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
| Vitest (cả E2E API), Testcontainers | [hands-on-testing-guide.md](../hands-on-testing-guide.md) | Tuần 2–3 |

## Workshop và blog

- **Chương của bạn trong workshop nhóm:** Đơn hàng không mất khi quá tải: API Gateway → Lambda → SQS → SES
- **Blog 1 (tuần 3):** Thiết kế bảng DynamoDB bắt đầu từ truy vấn: products, carts, orders
- **Blog 2 (tuần 5):** Chống tạo đơn trùng bằng Idempotency-Key và Powertools Idempotency
- **Blog 3 (tuần 7):** Vì sao bỏ Newman (16 High + 3 Critical khi `pnpm audit`) và cách viết E2E API bằng Vitest trong GitHub Actions ([ADR-0018](../adr/0018-e2e-api-bang-vitest.md))

## Làm tốt trông như thế nào

- Luồng xem hàng → giỏ → đặt hàng → nhận email chạy thật trên staging trước 02/11
- Không truy vấn nào dùng Scan
- Bấm đặt hàng hai lần chỉ ra 1 đơn; worker nhận một message hai lần chỉ gửi 1 email
- E2E API xanh ở mỗi lần deploy
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
- **Dòng CV gợi ý:** "Xây dựng luồng bán hàng end-to-end (catalog, giỏ hàng, đặt hàng) trên AWS Lambda, DynamoDB, SQS và SES; xử lý đơn bất đồng bộ không mất đơn, không trùng đơn; viết unit test, integration test (Testcontainers) và E2E API (Vitest) chạy trong CI sau mỗi lần deploy."
