# Trang Hàng mới về

Chốt 27/11/2026 (#567). Trước đây "Hàng mới về" trỏ `/products?sort=newest`, ra cùng kết quả với "Tất cả sản phẩm" (sắp xếp mặc định đã là mới nhất).

## 1. Đường dẫn và dữ liệu

- `/new-arrivals`, nền trắng như trang danh sách (`handle.surface = 'plain'`).
- `GET /api/v1/products?sort=newest&limit=20`: API sẵn có, không đổi contract. Hàng hết vẫn xếp cuối (catalog.md BR-08). Không dùng `nextCursor`.
- `/products?sort=newest` vẫn mở được như cũ (trang danh sách, sắp xếp mới nhất).
- Link tới trang này: hàng 2 header "Hàng mới về" (đánh dấu khi đang ở trang), footer cột "Mua sắm", "Xem tất cả" của khối "Hàng mới về" ở trang chủ và giỏ rỗng.

## 2. Bố cục

- `Breadcrumb`: Trang chủ › Hàng mới về.
- H1 "Hàng mới về" (cỡ như tiêu đề trang danh sách), dòng phụ "20 sản phẩm mới nhất của shop" `--fg-muted`.
- Lưới `ProductListCard` (thẻ của trang danh sách, §9.19): 2 cột <768, 3 cột 768–1279, 5 cột ≥1280. Không cột lọc, không thanh sắp xếp, không chuyển trang.
- Cuối lưới, căn giữa, cách 32px: nút phụ "Xem tất cả sản phẩm" (`buttonClass()`, link `/products`).

## 3. Trạng thái

| Trạng thái | Hiện |
|---|---|
| Đang tải | "Đang tải sản phẩm…", giữ chỗ cao bằng màn hình (không xô footer) |
| Lỗi | "Chưa tải được sản phẩm." + nút phụ `sm` "Thử lại" (`role="alert"`) |
| Không có món | `EmptyState` "Shop chưa có sản phẩm nào." + "Xem tất cả sản phẩm" |

## 4. Trợ năng

- `document.title` "Hàng mới về | Black Magic".
- Link hàng 2 có `aria-current="page"` khi đang ở trang.

