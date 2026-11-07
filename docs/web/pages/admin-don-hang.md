# Quản trị đơn hàng `/admin`

Code: `features/admin/pages/AdminOrdersPage.tsx`, `shared/components/ConfirmDialog.tsx`, `shared/api/types.ts` (type sinh từ contract). API: `GET /api/v1/admin/orders`, `PATCH /api/v1/admin/orders/{orderId}` (contracts/openapi.yaml, ordering.md BR-15). Đọc kèm [design-system.md](../design-system.md).

Người làm: **Hoàng** (#382). Phạm vi bản `v1.0.0-rc.1`: admin chuyển đơn `CONFIRMED` → `SHIPPED` → `DELIVERED`. **Không có** admin huỷ đơn, thêm sản phẩm, xem đơn đã giao hay đã huỷ (làm sau rc.1).

## 1. Ai thấy gì

| Người | Kết quả |
|---|---|
| Chưa đăng nhập | Sang `/login` như `/orders` (`useRequireSignIn`) |
| Đã đăng nhập, không thuộc nhóm `admin` (nhóm đọc từ token đăng nhập, `useAccount().user.isAdmin`), hoặc đọc hồ sơ lỗi | Khung trạng thái rỗng (§9.12): "Bạn không có quyền xem trang này." + link "Về trang chủ". Không gọi API admin |
| Thuộc nhóm `admin` | Nội dung bên dưới. Backend vẫn kiểm nhóm (threat model O3), giao diện không phải lớp bảo vệ |

Link "Trang quản trị" trong menu tài khoản (§9.17) đã trỏ tới `/admin`. Code trang tải riêng (route `lazy`), không cộng vào JS ban đầu.

## 2. Bố cục

Header, footer như các trang khác. Khung nội dung tối đa 1200px, lề `--gutter`.

- Đường dẫn (§9.22): "Trang chủ › Quản trị đơn hàng".
- Tiêu đề trang 24/32/700 "Quản trị đơn hàng"; dòng phụ 14/20 `--fg-muted`: "Chuyển đơn đã xác nhận sang đang giao khi giao cho vận chuyển, rồi sang đã giao khi khách nhận hàng."
- Hai tab trạng thái, hình chip (§6): **"Chờ giao"** (đơn `CONFIRMED`, mặc định) và **"Đang giao"** (đơn `SHIPPED`). Tab đang xem lưu trên URL (`?status=SHIPPED`), F5 giữ nguyên.
- Danh sách đơn (mới nhất trước, 20 đơn mỗi trang) và `CursorPager` (§9.21) bên dưới.

### Máy tính (≥768)

Khối trắng bo 16 (`--radius-2xl`), padding `8px 24px`, chứa bảng:

| Cột | Nội dung |
|---|---|
| Mã đơn | đủ 26 ký tự, font `--font-mono` 13px (để đối chiếu với khách, log) |
| Ngày đặt | `dd/mm/yyyy hh:mm` giờ Việt Nam |
| Số món | số, căn phải |
| Tổng tiền | `Price` đậm, căn phải |
| Trạng thái | nhãn §9.7: "Đã xác nhận" (primary) hoặc "Đang giao" (accent) |
| (nút) | nút phụ cỡ `sm`: "Chuyển sang Đang giao" ở tab Chờ giao, "Đã giao" ở tab Đang giao |

Không dùng nút `primary` trong bảng (mỗi màn hình một nút chính). Tiêu đề cột 14/20/600 `--fg-muted`, dòng cách nhau bằng viền `--border-divider`.

### Điện thoại (<768)

Mỗi dòng bảng thành một thẻ trắng bo 12 (`--radius-xl`), padding 16, cách nhau 12px (vẫn là bảng với trình đọc màn hình, hàng tiêu đề ẩn). Mỗi thẻ: hàng 1 mã đơn đủ 26 ký tự (mono); hàng 2 ngày đặt (`--fg-muted`) + nhãn trạng thái bên phải; hàng 3 "N món" (`--fg-muted`) + tổng tiền bên phải; cuối là nút rộng hết thẻ. Hai tab chia đều bề ngang.

## 3. Chuyển trạng thái

1. Bấm nút trên dòng → `ConfirmDialog` (§9.14):
   - Chờ giao: tiêu đề "Chuyển đơn sang Đang giao?", nội dung "Đơn {mã} · N món · {tổng tiền}. Sau khi chuyển, khách không tự huỷ đơn này được nữa.", nút "Để sau" (secondary) + "Chuyển sang Đang giao" (primary).
   - Đang giao: tiêu đề "Xác nhận khách đã nhận đơn?", nút "Để sau" + "Đã giao".
   - Điện thoại: hai nút xếp dọc, nút chính ở trên, rộng hết hộp.
2. Bấm nút chính → `PATCH`; nút đổi "Đang chuyển…" (`aria-busy`), chặn bấm lại.
3. Thành công: đóng hộp thoại, tải lại danh sách (đơn rời tab hiện tại); thông báo ngắn qua `LiveAnnouncer`: "Đã chuyển đơn {8 ký tự cuối} sang Đang giao".
4. Lỗi:
   - 409 `INVALID_STATUS_TRANSITION`: `Alert` warning trong hộp thoại "Đơn đã ở trạng thái {nhãn của currentStatus}. Danh sách đã được tải lại." rồi tải lại danh sách.
   - 404: `Alert` "Không tìm thấy đơn. Nếu đơn vừa đổi trạng thái, thử lại sau ít giây."
   - 403: chuyển sang màn "không có quyền".
   - Lỗi khác: "Chưa chuyển được đơn. Thử lại sau." Không đóng hộp thoại.

## 4. Trạng thái tải, rỗng, lỗi (§9.12)

- Đang tải: dòng "Đang tải đơn…".
- Rỗng: khung rỗng "Không có đơn chờ giao." / "Không có đơn đang giao."
- Lỗi tải: "Chưa tải được danh sách đơn. Tải lại trang để thử lần nữa." (`role="alert"`).

## 5. Không hiện

Địa chỉ giao hàng, họ tên, SĐT, `userId` (API admin không trả, threat model O8). Không có tab "Đã giao", "Đã huỷ" ở rc.1 (contract chỉ cho xem `CONFIRMED`, `SHIPPED`).

## 6. Trợ năng

- Đổi tab là đổi URL nên hai tab là link trong `<nav aria-label="Trạng thái đơn">`, link đang chọn có `aria-current="page"`; không dùng mẫu tab của ARIA (`tablist`, `tab`, `tabpanel`) vì mẫu đó cần phím mũi tên và không đổi URL. Back của trình duyệt quay lại tab trước.
- Bảng ghi vai trò tường minh (`table`, `rowgroup`, `row`, `columnheader`, `cell`) vì điện thoại đổi `display` của dòng, ô sang grid.
- Chuyển đơn thành công: dòng vừa bấm rời danh sách nên focus chuyển lên tiêu đề trang (`h1` có `tabIndex={-1}`).
- Nút trên dòng có nhãn đọc kèm mã đơn: "Chuyển sang Đang giao: đơn {mã}".
- Hộp thoại dùng `<dialog>` mở bằng `showModal()` (giữ focus, Esc đóng), `aria-labelledby` tiêu đề, `aria-describedby` nội dung.
- Chuyển xong đọc câu ngắn qua `LiveAnnouncer`.
