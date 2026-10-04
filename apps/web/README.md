# apps/web

Web React + Vite + TypeScript, build ra file tĩnh, CDK đưa lên S3 và phát qua CloudFront.

## Nguyên tắc

- Chia thư mục theo tính năng: `features/catalog`, `features/cart`, `features/orders`, `features/recommendation`, `features/admin`
- Dữ liệu từ server lấy bằng TanStack Query; không tự viết cache
- Type của API sinh từ `contracts/openapi.yaml` bằng openapi-typescript
- Gọi API bằng đường dẫn tương đối `/api/v1/...`; CloudFront chuyển sang API Gateway, nên không có CORS
- Chia code theo trang (lazy route); JS ban đầu ≤ 250 KB gzip

## Chạy trên máy

```bash
# Cửa sổ 1: API giả dựng từ hợp đồng (http://localhost:4010)
pnpm dlx @stoplight/prism-cli mock contracts/openapi.yaml

# Cửa sổ 2: web (http://localhost:5173); Vite chuyển /api sang Prism
pnpm --filter web dev
```

- Prism chỉ trả ví dụ cố định trong OpenAPI, nên lọc, tìm và phân trang chưa đổi kết quả thật. Khi có API trên dev thì hết.
- Trang giỏ và đơn hàng cần đăng nhập. Trước khi có Cognito, vào `/login` và bấm nút đăng nhập thử (token giả, chỉ chạy ở chế độ dev).
- Sửa `contracts/openapi.yaml` xong thì sinh lại type: `pnpm --filter web generate:types`.

## Giao diện

Quy ước màu, chữ, khoảng cách và component dùng chung: [docs/web/giao-dien.md](../../docs/web/giao-dien.md). Giá trị nằm trong `src/styles/tokens.css`.

## Script cần có trong `package.json`

`dev`, `lint`, `typecheck`, `test` (Vitest + Testing Library), `build`. Tên package là `web`.
