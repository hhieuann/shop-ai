# ADR-0018: E2E API bằng Vitest + fetch, không dùng Newman trong CI

- Trạng thái: Chấp nhận
- Ngày: 13/10/2026
- Người quyết: An, theo đề xuất của Hoàng

## Bối cảnh

- Kế hoạch ban đầu (engineering-plan, hands-on-testing-guide mục 6): E2E API là Postman collection, chạy bằng Newman trong `deploy.yml` sau mỗi lần deploy dev và staging. Lệnh gọi là `pnpm run test:e2e`, nên Newman phải nằm trong `tests/e2e-api/package.json` và `pnpm-lock.yaml`.
- `pr.yml` chạy `pnpm audit --audit-level high` trên **mọi** thư viện, kể cả devDependencies. Có lỗ hổng mức High hoặc Critical thì PR không merge được.
- Ngày 13/10 Hoàng và An cùng cài thử `newman` 6.2.3 (bản mới nhất) vào `tests/e2e-api`:

| Cài | Low | Moderate | High | Critical |
|---|---|---|---|---|
| `newman` 6.2.3 | 1 | 13 | 16 | 3 |
| `newman` + `newman-reporter-htmlextra` 1.23 | 1 | 13 | 17 | 3 |

- Toàn bộ lỗ hổng High và Critical nằm trong thư viện con của `postman-runtime`, không phải code của nhóm: `handlebars` 4.7.8 (cần ≥ 4.7.10, có mức Critical), `node-forge` 1.3.1, `flatted`, `lodash`, `underscore`, `@faker-js/faker` 5.5.3 (cần ≥ 10.5.0).
- `node-forge` có một lỗ hổng **chưa có bản vá** (GHSA-86w9-cpqp-85rv). Ép bản vá bằng `overrides` vừa không hết lỗi, vừa phải nâng `@faker-js/faker` từ 5 lên 10, gần như chắc làm hỏng Newman.
- Image Docker chính thức `postman/newman` dừng ở 6.1.3 (06/2024), cũ hơn bản trên npm.
- `tests/smoke` (An) đã gọi API thật qua CloudFront bằng Vitest + `fetch`, chạy trong cùng `deploy.yml`.

## Quyết định

**1. E2E API viết bằng Vitest + `fetch`** trong `tests/e2e-api/`, cùng mẫu với `tests/smoke`:

- Không thêm thư viện nào: dùng lại `vitest`, `typescript` đã có trong workspace. `pnpm audit` giữ sạch.
- `deploy.yml` vẫn gọi `pnpm run test:e2e` với các biến đang có, không đổi lệnh.
- Đăng nhập Cognito bằng `fetch` tới `InitiateAuth` (`USER_PASSWORD_AUTH`, app client E2E chỉ có ở dev và staging), không cần AWS SDK.
- `vitest.config.ts` đọc `BASE_URL` trước khi Vite đè thành `/`, chuyển cho test qua biến riêng (cùng cách `tests/smoke`).
- Thiếu `BASE_URL` hoặc thông tin đăng nhập thì bỏ qua cả bộ kèm cảnh báo vàng trên GitHub Actions: chạy ở máy, ở PR, hay ở environment chưa có người dùng E2E đều không đỏ.
- Bước có ghi dữ liệu (giỏ của người dùng E2E) chạy tuần tự, không thử lại, có bước dọn ở cuối.
- Các bước giữ như thiết kế cũ: đăng nhập, xem hàng, giỏ, ca lỗi; đặt hàng thêm ở Sprint 2.

**2. Postman chỉ còn để thử API bằng tay.** Không commit collection, không chạy trong CI.

**3. Không bỏ qua lỗ hổng bằng `auditConfig.ignoreGhsas`.** Danh sách bỏ qua áp cho cả repo: sau này code thật dùng `lodash` hay `handlebars` dính lỗ hổng cùng mã thì CI cũng im lặng.

## Các lựa chọn đã cân nhắc

| Lựa chọn | Độ phức tạp | Chi phí | Hợp với nhóm |
|---|---|---|---|
| **Vitest + `fetch` như smoke test (chọn)** | Thấp: cùng ngôn ngữ, cùng công cụ với unit test | 0 thư viện mới | Có |
| Giữ Newman, thêm khoảng 19 mã GHSA vào `auditConfig.ignoreGhsas` | Thấp | Ngoại lệ bảo mật áp cho cả repo; `node-forge` còn lỗ hổng chưa vá | Không |
| Chạy `pnpm dlx newman` lúc chạy, không ghi vào lockfile | Thấp | Lách bước audit, cùng mã có lỗ hổng vẫn chạy trong CI có secret | Không |
| Chạy image Docker `postman/newman` | Vừa | Image dừng ở 6.1.3 (06/2024), cũ hơn npm | Không |
| Ép bản vá bằng `overrides` | Cao | Phải nâng `faker` 5 → 10, dễ hỏng Newman; vẫn còn lỗ hổng chưa vá | Không |

## Hệ quả

- **Dễ hơn:**
  - `pnpm audit` giữ sạch, không có ngoại lệ bảo mật;
  - E2E viết bằng TypeScript, theo AAA+ như phần còn lại của repo, review cùng một cách;
  - không phải giữ file JSON collection và environment.
- **Khó hơn:**
  - không có giao diện Runner và báo cáo HTML của Postman; báo cáo là log Vitest và `reports/junit.xml`;
  - Blog 3 của Hoàng đổi chủ đề thành chính quyết định này.
- **Cần xem lại khi:**
  - `newman` ra bản không còn lỗ hổng High hoặc Critical;
  - E2E cần nhiều thứ Postman làm sẵn (dữ liệu sinh theo mẫu, chạy song song nhiều environment).
