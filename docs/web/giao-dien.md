# Giao diện web: Black Magic

Người viết: Hoàng · Ngày: 04/10/2026 · Cập nhật: 10/11/2026 (bản chốt trang 404; ô mật khẩu và ô mã 6 ô)

Quy ước giao diện chung cho `apps/web`. Ai làm thêm trang hay widget (ví dụ widget gợi ý, trang đăng nhập) đọc mục 1, 2 và 6 là đủ.

Đây là bản tóm tắt. Bản đầy đủ (mọi token, component, trạng thái) ở [design-system.md](design-system.md); spec từng trang ở [`pages/`](pages/).

> **Giao diện chàm (11/10/2026):** màu chàm, font Inter, header 2 hàng, footer 4 cột và trang chủ mới đã có trong code.
> **Trang danh sách (chốt 13/10/2026):** nền trắng, cột lọc "Loại hàng" bên trái, thẻ có nút "Thêm vào giỏ", chuyển trang "Trước · Trang N · Sau", thanh cuộn mảnh cho cả web ([pages/danh-sach-san-pham.md](pages/danh-sach-san-pham.md)).
> **Trang chi tiết sản phẩm (chốt 03/11/2026, đã có trong code):** khối trắng bo 16px trên nền xám, mô tả cạnh ảnh, thông số là các ô chia đều theo hàng trong khối riêng, bấm ô mở panel bên phải; hộp mua 360px không dính; hàng 2 header thu lại khi cuộn ở máy tính ([pages/chi-tiet-san-pham.md](pages/chi-tiet-san-pham.md)).
> **Đơn hàng (chốt 09/11/2026, đã có trong code):** đơn gọi theo tên món đầu "… và N sản phẩm khác", mã đơn là dòng chữ mờ; chi tiết đơn có thanh 4 bước trạng thái, khối Thanh toán bên phải với nút "Huỷ đơn" hỏi lại trước khi huỷ; trang đặt hàng dùng header thu gọn ([pages/don-hang.md](pages/don-hang.md), [pages/dat-hang.md](pages/dat-hang.md)).
> **Trang 404 (chốt 10/11/2026, code chưa đổi):** header đầy đủ, một khối trắng bo 16px có icon, tiêu đề "Không tìm thấy trang", câu gợi ý dùng ô tìm kiếm, nút "Về trang chủ" và "Xem tất cả sản phẩm" ([pages/khong-tim-thay.md](pages/khong-tim-thay.md)).

## 1. Nguyên tắc

- **Bố cục theo trang tham khảo chính** (đổi 11/10/2026). Nhóm nút bên phải header giữ như bản trước: nút Đơn hàng, nút Đăng nhập và icon Giỏ hàng.
- **Màu chủ đạo chàm.** Nền trang xám nhạt `#F5F5F5`, khối và thẻ trắng, chữ `#1A1A1A`. Không có giao diện tối.
- **Header và footer cùng màu chàm** `#4338CA`, chữ trắng. Hàng 2 của header nền trắng có 6 link mua theo nhu cầu.
- **Không ghi cứng mã màu trong component.** Chỉ dùng biến ngữ nghĩa: `--bg-*`, `--fg-*`, `--border-*`.
- **Mỗi màu nhấn có một việc:**

  | Màu | Biến | Chỉ dùng cho |
  |---|---|---|
  | Chàm `#4F46E5` (chữ chàm `#4338CA`) | `--bg-primary`, `--fg-primary` | Hành động: nút chính, link, mục đang chọn |
  | Cyan `#0E7490` | `--fg-accent`, `--bg-accent-tint` | Điểm nhấn nhỏ, trạng thái "Đang giao" |
  | Xanh / đỏ / cam | `--fg-success`, `--fg-danger`, `--fg-warning` | Trạng thái: còn hàng, lỗi, sắp hết |

- **Giá màu đen**, đậm 700, qua component `Price`. Không giá gốc, không "-%".
- **Hàng sản phẩm không khung**: tiêu đề và hàng thẻ nằm thẳng trên nền xám; **thẻ sản phẩm** trắng bo 12px, ô ảnh vuông chạm mép, tên một dòng, giá và nhãn tồn kho cùng hàng, có bóng khi rê chuột.
- **Trang danh sách** dùng nền trắng và **thẻ riêng không khung**: ô ảnh xám bo 8px, hãng, tên tối đa 2 dòng, dòng thông số, giá lớn, nút "Thêm vào giỏ" (design-system §9.19). Ngoài thẻ trang chủ và thẻ này không thêm kiểu thẻ nào.
- **Ô tìm kiếm dạng viên thuốc** (bo tròn hẳn hai đầu, nút tìm tròn đen trong ô).
- **Thanh cuộn mảnh** 10px, bo tròn, xám nhạt, không mũi tên, dùng cho cả web (design-system §4).

## 2. Chữ

Font **Inter** (có dấu tiếng Việt), dự phòng system-ui, Segoe UI, Roboto. Nội dung mặc định 16/24.

| Vai trò | Cỡ / line-height / đậm |
|---|---|
| Tiêu đề hero | 28 / 36 / 700 |
| Tiêu đề khối sản phẩm, H1 trang | 24 / 32 / 700 và 600 (điện thoại 20 / 28) |
| Giá thẻ | 17 / 24 / 700 (điện thoại 15 / 22) |
| Giá thẻ trang danh sách | 24 / 32 / 700 (điện thoại 20 / 28) |
| Nội dung, link nav | 16 / 24, 16 / 22 / 600 |
| Nội dung phụ, mục menu | 14 / 20, 14 / 18 / 500 |
| Tên sản phẩm trong thẻ | 13 / 20 / 600, một dòng |

## 3. Khoảng cách và bố cục

- Khoảng cách theo bậc 4px; hay dùng 8, 12, 16, 24, 32.
- Nội dung rộng tối đa 1920px, căn giữa. Lề hai bên `--gutter`: 16px → 24px (≥640) → 40px (≥960) → 64px (≥1280).
- Header đầy đủ 2 hàng từ 1280px; dưới 1280px dùng header điện thoại.
- Bo góc: 4px nhãn, 8px nút/ô nhập, 10px nút header, 12px thẻ sản phẩm/menu/hero/ô, 16px hộp thoại, tròn hẳn cho ô tìm kiếm.
- **Kiểm giao diện ở 3 cỡ màn hình:** 1920px, 1366px, 390px.

## 4. Component dùng chung

| Component | Ở đâu | Dùng khi |
|---|---|---|
| Header, Footer | `app/` | Mọi trang khách (trừ đặt hàng, đăng nhập dùng `FocusLayout`) |
| `AccountMenu` | `app/AccountMenu.tsx` | Nút Đăng nhập / username trên header |
| `CategoryMenu` | `features/catalog/components/CategoryMenu.tsx` | 13 loại hàng: cột trái trang chủ, nút "Danh mục", ngăn kéo trên điện thoại |
| `Price` | `shared/components/Price.tsx` | Mọi chỗ hiện giá |
| `StoryBlock` | `shared/components/StoryBlock.tsx` | Một khối có tiêu đề (khối sản phẩm) |
| `Carousel` | `shared/components/Carousel.tsx` | Dải thẻ sản phẩm có nút mũi tên |
| `ProductCard`, `StockBadge`, `CategoryIcon` | `features/catalog/components/` | Thẻ sản phẩm, nhãn tồn kho, icon loại hàng |
| `Field`, `PasswordField`, `OtpInput` (chưa có), `Checkbox`, `QuantityStepper`, `Alert`, `OrderSummary` | `shared/components/` | Form, giỏ hàng, đặt hàng, đăng nhập |
| `ProductListCard`, `AddToCartButton`, `FilterPanel`, `FilterSheet`, `CursorPager`, `Breadcrumb`, `Radio` | `features/catalog/`, `features/cart/`, `shared/components/` | Trang danh sách (design-system §9.5, §9.19–§9.23) |
| `SpecTiles`, `SpecPanel` (chưa có) | `features/catalog/components/` | Ô thông số và panel thông số của trang chi tiết (design-system §9.24) |

Style viết bằng **CSS Modules** (`*.module.css` cạnh component), không dùng thư viện UI. Icon dùng `lucide-react`, nét 1.75.

## 5. Truy cập (accessibility)

- Mọi thứ bấm được phải dùng được bằng bàn phím, có viền focus `--focus-ring` (trên nền chàm: trắng).
- Có link "Bỏ qua tới nội dung chính" ở đầu trang.
- Tương phản chữ trên nền đạt WCAG AA (4.5:1 cho chữ thường). `--fg-subdued` `#737373` chỉ dùng trên nền trắng.
- Ảnh có `alt`; icon chỉ để trang trí thì `aria-hidden`.

## 6. Ghi chú cho phần của An

- **Widget gợi ý** ("Đang được mua nhiều" / "Dành cho bạn" ở trang chủ, "Thường mua kèm" ở trang chi tiết và giỏ): bọc trong `StoryBlock`, hiện sản phẩm bằng `ProductCard` trong `Carousel`, giống các khối sản phẩm ở trang chủ ([pages/trang-chu.md](pages/trang-chu.md) §3.5–3.6). Như vậy tự khớp giao diện, không cần CSS riêng.
- **Đăng nhập:** spec ở [pages/dang-nhap.md](pages/dang-nhap.md); trang dùng `FocusLayout` (header thu gọn màu chàm).
