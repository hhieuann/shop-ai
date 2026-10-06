# Giao diện web: Black Magic

Thư mục này chứa toàn bộ quy ước giao diện cho `apps/web`. Mọi giá trị màu, chữ, khoảng cách nằm trong code ở [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css); tài liệu ở đây giải thích **dùng cái gì, ở đâu, trông ra sao**.

## Đọc theo thứ tự nào

| Bạn đang làm | Đọc |
|---|---|
| Lần đầu làm giao diện của dự án | [giao-dien.md](giao-dien.md) (5 phút) → [design-system.md](design-system.md) |
| Một trang cụ thể | [design-system.md](design-system.md) + đúng file trang trong [`pages/`](pages/) |
| Nhờ AI code giao diện | Đưa AI: README này + `design-system.md` + file trang cần làm. **Không** đưa file trang khác |
| Định thêm tính năng mới | [ngoai-pham-vi.md](ngoai-pham-vi.md) (đã có trong danh sách không làm chưa?) |
| Làm màn hình chưa có spec (đơn hàng, admin, 404, trạng thái rỗng) | [man-hinh-du-kien.md](man-hinh-du-kien.md) |

## Các file

| File | Nội dung |
|---|---|
| [giao-dien.md](giao-dien.md) | Tóm tắt quy ước chung: nguyên tắc màu, chữ, khoảng cách, component có sẵn |
| [design-system.md](design-system.md) | Đầy đủ: token, chữ, bố cục, trạng thái tương tác, trợ năng, **mọi component dùng chung** |
| [pages/trang-chu.md](pages/trang-chu.md) | Trang chủ `/` |
| [pages/danh-sach-san-pham.md](pages/danh-sach-san-pham.md) | Danh sách và kết quả tìm kiếm `/products?q=&category=&sort=` |
| [pages/chi-tiet-san-pham.md](pages/chi-tiet-san-pham.md) | Chi tiết sản phẩm `/products/:productId` |
| [pages/gio-hang.md](pages/gio-hang.md) | Giỏ hàng `/cart` |
| [pages/dat-hang.md](pages/dat-hang.md) | Đặt hàng `/checkout` |
| [pages/dang-nhap.md](pages/dang-nhap.md) | Đăng nhập `/login`, tạo tài khoản `/register` (An làm) |
| [man-hinh-du-kien.md](man-hinh-du-kien.md) | Màn hình dự án cần nhưng chưa có spec trang: component dùng lại, bố cục đề xuất, mức tin cậy |
| [ngoai-pham-vi.md](ngoai-pham-vi.md) | Tính năng cửa hàng điện tử thường có nhưng dự án **không làm**, kèm lý do |

Trang **chưa có** spec riêng (sẽ thêm vào `pages/` khi làm): lịch sử đơn `/orders` và chi tiết đơn `/orders/:id`, các trang admin. Trước khi có spec, các trang này dùng component trong `design-system.md` và nghiệp vụ trong `docs/business/`.

## Nguồn sự thật

1. **Nghiệp vụ** (`docs/business/*.md`) quyết định màn hình **có gì**. Giao diện không thêm tính năng mà nghiệp vụ không có.
2. **Code** (`tokens.css`, `base.css`, component trong `shared/` và `features/*/components/`) quyết định **giá trị**. Tài liệu lệch code thì sửa tài liệu, hoặc sửa code trong cùng PR.
3. **Thư mục này** mô tả chi tiết và là chuẩn cho phần chưa code.

## Quy tắc giữ thư mục gọn

- File trang chỉ mô tả **bố cục và khối riêng của trang đó**, gọi tên component; không định nghĩa lại màu, cỡ chữ, nút.
- Component dùng ở **từ 2 trang trở lên** thì chuyển lên `design-system.md`.
- Thiết kế màn hình chưa có spec: ghi phương án vào [man-hinh-du-kien.md](man-hinh-du-kien.md) trước, chốt rồi mới viết spec trong `pages/`.
- Thêm trang mới: chép cấu trúc của `pages/danh-sach-san-pham.md` (Đường dẫn và dữ liệu → Bố cục → Các khối → Trạng thái → Responsive → Trợ năng → Việc còn lại).
- Đổi token: sửa `tokens.css` và bảng token trong `design-system.md` trong cùng một PR.
