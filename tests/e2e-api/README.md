# tests/e2e-api

E2E gọi API thật bằng Postman Collection, chạy tự động bằng Newman. Hoàng phụ trách. Cách viết: [docs/hands-on-testing-guide.md](../../docs/hands-on-testing-guide.md) mục 6.

```text
tests/e2e-api/
├─ package.json                             tên package: e2e-api; script test:e2e chạy Newman
├─ postman/shop-e2e.postman_collection.json
├─ postman/dev.postman_environment.json     không chứa mật khẩu
├─ postman/staging.postman_environment.json không chứa mật khẩu
└─ reports/                                 báo cáo HTML, đã có trong .gitignore
```
