# tests/e2e-api

E2E gọi API thật qua CloudFront trên dev và staging, chạy tự động trong `deploy.yml` ngay sau smoke test. Viết bằng Vitest + `fetch`, cùng cách với `tests/smoke`; lý do không dùng Postman/Newman: [ADR-0018](../../docs/adr/0018-e2e-api-bang-vitest.md). Hoàng phụ trách. Cách viết, biến môi trường, cách chạy: [docs/hands-on-testing-guide.md](../../docs/hands-on-testing-guide.md) mục 6.

```text
tests/e2e-api/
├─ package.json           tên package: e2e-api; script test:e2e = vitest run
├─ vitest.config.ts       đọc biến môi trường; thiếu thì bỏ qua cả bộ
├─ api.ts                 gọi API qua CloudFront, đăng nhập Cognito
├─ auth.e2e.ts            đăng nhập, GET /me
├─ catalog.e2e.ts         danh sách, lọc, tìm, trang sau, chi tiết
├─ cart.e2e.ts            thêm, sửa, xoá món trong giỏ của người dùng E2E
├─ orders.e2e.ts          đặt, gửi lại cùng Idempotency-Key, xem, chờ worker xác nhận, huỷ đơn; luôn huỷ đơn vừa đặt
├─ events.e2e.ts          ghi VIEW, ADD_TO_CART; từ chối PURCHASE, userId trong body, thiếu token
├─ negative.e2e.ts        thiếu token, dữ liệu sai, không tìm thấy, sai mật khẩu
└─ reports/               junit.xml, đã có trong .gitignore
```

Chạy ở máy (xin An thông tin người dùng E2E, không ghi vào file):

```bash
BASE_URL=https://<cloudfront dev> COGNITO_CLIENT_ID=<id> E2E_USERNAME=<email> E2E_PASSWORD=<mật khẩu> \
  pnpm --filter e2e-api test:e2e
```

Thiếu biến thì cả bộ được bỏ qua, không báo đỏ.
