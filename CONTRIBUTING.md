# Cách đóng góp

Đọc trước hai tài liệu này:

- [docs/git-flow.md](docs/git-flow.md): nhánh, commit, PR, phát hành, hotfix, xử lý conflict
- [docs/hands-on-testing-guide.md](docs/hands-on-testing-guide.md): viết và chạy unit, integration, E2E

Trang này là bản tóm tắt để làm hằng ngày.

## Làm một việc từ đầu đến cuối

1. Nhận issue trên bảng dự án, kéo sang **In progress**.
2. Tách nhánh từ `develop` mới nhất:
   ```bash
   git checkout develop && git pull origin develop
   git checkout -b feature/12-cart-api
   ```
3. Viết test theo AAA+ trước, rồi code. Chạy `pnpm test` (Docker Desktop phải đang chạy).
4. Thử trên cloud bằng `pnpm --filter infra exec cdk watch --hotswap` ở **tài khoản AWS của mình**. Hotswap chỉ dùng cho dev cá nhân.
5. Commit theo chuẩn `<type>(<scope>): <mô tả>`, ví dụ `feat(cart): thêm API cập nhật số lượng`.
6. Mở PR vào `develop`:
   - Tiêu đề: `merge(feature/12-cart-api): tích hợp API giỏ hàng vào develop`
   - Mô tả theo mẫu, có `Closes #12`
7. Sửa theo review bằng commit `fixreview(...)`. Khi CI xanh và có 1 người duyệt thì bấm **Create a merge commit**.

## Quy tắc ngắn

- Không push thẳng vào `main`, `develop`, `release/*`. Không force push lên nhánh dùng chung.
- PR dưới khoảng 400 dòng thay đổi. Review trong 24 giờ. Không tự duyệt PR của mình.
- `CODEOWNERS` tự gán người review theo module.
- Chỉ An tạo nhánh `release/*` và tag `v*` (docs/git-flow.md mục 4.4).

## Chuẩn code

- Handler mỏng: parse → gọi use case → map kết quả
- `domain` là hàm và class thuần, không I/O, không import AWS SDK. CI kiểm bằng `pnpm deps:check`
- Lỗi nghiệp vụ là class riêng, đổi sang HTTP ở một chỗ duy nhất; lỗi trả về theo RFC 9457 kèm `traceId`
- Log JSON qua Powertools Logger, có `correlationId`; không `console.log`; không ghi email, SĐT, địa chỉ vào log
- Cấu hình qua biến môi trường và Parameter Store; không ghi cứng ARN, tên bảng hay account ID
- Không dùng `any` nếu không có chú thích lý do
- Tiền là số nguyên VND; thời gian là ISO 8601 UTC; ID dạng ULID

## Definition of Ready

- Có user story và tiêu chí nghiệm thu dạng Given / When / Then
- API liên quan đã có trong `contracts/openapi.yaml`
- Có phác thảo màn hình nếu có giao diện
- Biết phụ thuộc vào việc nào, đã ước lượng

## Definition of Done

- Merge qua PR, 1 người khác duyệt, CI xanh
- Có test theo docs/hands-on-testing-guide.md; response khớp OpenAPI
- Lên dev tự động; người khác nghiệm thu theo tiêu chí
- Có log và metric cần thiết; không thêm lỗ hổng High hoặc Critical
- Cập nhật tài liệu hoặc ADR nếu đổi thiết kế

## Không bao giờ commit

- `.env`, `*.pem`, access key, file `.csv` chứa mật khẩu, dữ liệu thật của người dùng
- Ảnh chụp lộ account ID hoặc email; làm mờ trước khi đưa vào tài liệu
- Ảnh và mô tả sản phẩm lấy từ trang shop khác

Lỡ commit secret: báo ngay cho An, **thu hồi secret đó trước**, rồi mới xoá khỏi lịch sử. Xoá khỏi repo không làm secret an toàn trở lại.

## Ghi chú về pnpm

pnpm chặn script cài đặt của thư viện bên thứ ba. Khi thêm thư viện cần build lúc cài (ví dụ esbuild khi dùng CDK hoặc Vite), chạy `pnpm approve-builds` và commit thay đổi đi kèm.
