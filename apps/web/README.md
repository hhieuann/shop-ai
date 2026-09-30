# apps/web

Web React + Vite + TypeScript, build ra file tĩnh, CDK đưa lên S3 và phát qua CloudFront.

## Nguyên tắc

- Chia thư mục theo tính năng: `features/catalog`, `features/cart`, `features/orders`, `features/recommendation`, `features/admin`
- Dữ liệu từ server lấy bằng TanStack Query; không tự viết cache
- Type của API sinh từ `contracts/openapi.yaml` bằng openapi-typescript
- Gọi API bằng đường dẫn tương đối `/api/v1/...`; CloudFront chuyển sang API Gateway, nên không có CORS
- Chia code theo trang (lazy route); JS ban đầu ≤ 250 KB gzip

## Làm khi API chưa xong

```bash
pnpm dlx @stoplight/prism-cli mock contracts/openapi.yaml
```

Prism dựng API giả ở `http://localhost:4010` đúng theo OpenAPI.

## Script cần có trong `package.json`

`dev`, `lint`, `typecheck`, `test` (Vitest + Testing Library), `build`. Tên package là `web`.
