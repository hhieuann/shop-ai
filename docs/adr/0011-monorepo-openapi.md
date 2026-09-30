# ADR-0011: Monorepo pnpm, OpenAPI là nguồn sự thật của API

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An, Hoàng

## Bối cảnh

Web, API, hạ tầng và phần dữ liệu thay đổi cùng nhau. Web cần làm song song khi API chưa xong.

## Quyết định

- Một repo, pnpm workspaces: `apps/*`, `services/*`, `infra`, `tests/*`. Phần Python ở `data/`, quản lý bằng uv.
- `contracts/openapi.yaml` viết trước code. Web và API sinh type từ file này (openapi-typescript).
- Web chạy trên mock Prism từ file OpenAPI cho tới khi API thật xong.
- Handler kiểm input bằng zod; test kiểm response khớp OpenAPI; Schemathesis fuzz API mỗi đêm.

## Hệ quả

- Dễ hơn: một PR đổi được cả API, web và hạ tầng; web không phải chờ backend.
- Khó hơn: đổi API phải sửa OpenAPI trước, có kỷ luật.
