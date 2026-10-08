# tests/smoke

Smoke test chạy ngay sau mỗi deploy (dev, staging, prod) trong `deploy.yml` và `deploy-prod.yml`: vài lệnh gọi thật qua CloudFront để biết web và API còn chạy. An phụ trách. Chỉ gọi API chỉ đọc, nên an toàn trên prod.

| Kiểm | Mong đợi |
|---|---|
| `GET /api/v1/health` | 200 `{"status":"ok"}`, `Cache-Control: no-store` |
| `GET /api/v1/products?limit=1` rồi chi tiết sản phẩm đầu | 200 |
| Sản phẩm không tồn tại | 404 `application/problem+json` |
| `GET /api/v1/me` không token | 401 |
| `/` và route của React | HTML |
| `/config.json` | có `userPoolId`, `userPoolClientId` |

Chạy ở máy:

```bash
BASE_URL=https://d2pq03areagblb.cloudfront.net pnpm --filter smoke test:smoke
```

`BASE_URL` lấy từ biến cùng tên của environment trên GitHub (Settings → Environments). Chưa đặt thì smoke in cảnh báo và bỏ qua: lần deploy đầu của một môi trường chưa biết URL CloudFront; đặt biến ngay sau lần đó.

E2E đầy đủ (đăng nhập → giỏ → đặt hàng) nằm ở `tests/e2e-api` (Hoàng, Postman + Newman).
