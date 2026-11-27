# Quản trị đơn hàng `/admin`

Code: `features/admin/pages/AdminOrdersPage.tsx`, khung `app/AdminLayout.tsx` (design-system §9.29), `shared/components/ConfirmDialog.tsx`, `shared/api/types.ts` (type sinh từ contract). API: `GET /api/v1/admin/orders`, `PATCH /api/v1/admin/orders/{orderId}` (contracts/openapi.yaml, ordering.md BR-15), `DELETE /api/v1/admin/orders/{orderId}` (huỷ đơn, BR-11). Đọc kèm [design-system.md](../design-system.md).

Người làm: **Hoàng** (#382). Phạm vi: admin chuyển đơn `CONFIRMED` → `SHIPPED` → `DELIVERED` (rc.1) và huỷ đơn (bản sau `v1.0.0`, mục 3b, #450). **Không có** thêm sản phẩm, xem đơn đã giao hay đã huỷ.

## 1. Ai thấy gì

Khung quản trị (`AdminLayout`, design-system §9.29) kiểm quyền cho mọi trang `/admin/*` (từ #542; trước đó trang đơn hàng tự kiểm).

| Người | Kết quả |
|---|---|
| Chưa đăng nhập | Sang `/login` như `/orders` (`useRequireSignIn`) |
| Đã đăng nhập, không thuộc nhóm `admin` (nhóm đọc từ token đăng nhập, `useAccount().user.isAdmin`), hoặc đọc hồ sơ lỗi | Khung trạng thái rỗng (§9.12): "Bạn không có quyền xem trang này." + link "Về trang chủ". Không gọi API admin |
| Thuộc nhóm `admin`, **chưa bật xác thực hai lớp** | Chuyển sang `/account/two-factor` (`replace`) với câu "Tài khoản quản trị cần bật xác thực hai lớp." (account.md BR-10, tai-khoan.md 3.4); bật xong quay lại đúng trang admin đang mở (cả query, vd. `/admin?status=SHIPPED`). Không gọi API admin. Đọc trạng thái MFA lỗi thì hiện trang như bình thường |
| Thuộc nhóm `admin`, đã bật | Nội dung bên dưới. Backend vẫn kiểm nhóm (threat model O3), giao diện không phải lớp bảo vệ |

Chặn admin chưa bật MFA **chỉ ở web** (thêm 18/11/2026, #183): backend không kiểm MFA, gọi thẳng API admin vẫn chỉ cần token nhóm `admin`. Bảo vệ thật là An bật MFA cho tài khoản admin trên Cognito theo quy trình (threat model L5).

Link "Trang quản trị" trong menu tài khoản (§9.17) đã trỏ tới `/admin`. Code trang tải riêng (route `lazy`), không cộng vào JS ban đầu.

## 2. Bố cục

Trong khung quản trị (design-system §9.29): không header, hàng danh mục, footer của cửa hàng; mục "Đơn hàng" của cột trái (hoặc hàng chip dưới 960px) là mục hiện tại. Không đường dẫn (breadcrumb).

- Đầu trang: tiêu đề 24/32/700 "Quản trị đơn hàng"; dòng phụ 14/18 `--fg-muted`: "Chuyển đơn đã xác nhận sang đang giao khi giao cho vận chuyển, rồi sang đã giao khi khách nhận hàng." Cách khối bên dưới 24px.
- Một khối nền `--bg-surface`, viền 1px `--border-divider`, bo `--radius-xl`, gồm:
  - **Thanh công cụ** (padding `12px 16px`, viền dưới): nút phân đoạn hai mục **"Chờ giao"** (đơn `CONFIRMED`, mặc định) và **"Đang giao"** (đơn `SHIPPED`). Nền nhóm `--bg-subtle`, padding 2px, bo `--radius-lg`; mỗi mục cao 32px, padding `0 12px`, bo `--radius-md`, chữ 14/18/600 `--fg-muted`; mục đang chọn nền `--bg-surface`, chữ `--fg-heading`, `--shadow-xs`. Tab đang xem lưu trên URL (`?status=SHIPPED`), F5 giữ nguyên.
  - **Bảng** đơn (mới nhất trước, 20 đơn mỗi trang).
  - **Chân khối** (viền trên, padding `8px 16px`, cao tối thiểu 56px): "Hiện N đơn" 14/18 `--fg-muted` bên trái, `CursorPager` (§9.21) bên phải (chỉ có 1 trang thì không hiện).

### Máy tính (≥768)

Bảng:

| Cột | Nội dung |
|---|---|
| Mã đơn | đủ 26 ký tự, font `--font-mono` 13px (để đối chiếu với khách, log) |
| Ngày đặt | `dd/mm/yyyy hh:mm` giờ Việt Nam |
| Số món | số, căn phải |
| Tổng tiền | `Price` đậm, căn phải |
| Trạng thái | nhãn dạng viên (bo `--radius-full`, padding `2px 10px`, chữ 14/18/600) có chấm tròn 6px cùng màu chữ: "Đã xác nhận" (màu primary) hoặc "Đang giao" (accent) |
| (nút) | nút phụ cỡ `sm`: "Chuyển sang Đang giao" ở tab Chờ giao, "Đã giao" ở tab Đang giao; thêm nút "Huỷ đơn" ở cả hai tab (mục 3b; kiểu nút chốt ở #450 kèm ảnh mẫu) |

Không dùng nút `primary` trong bảng (mỗi màn hình một nút chính). Hàng tiêu đề nền `--bg-surface-raised`, chữ hoa 12/16/600 `--fg-subdued`, padding `8px 16px`; ô padding `10px 16px`, dòng cách nhau bằng viền `--border-divider`, rê chuột thì nền dòng `--bg-surface-raised`.

### Điện thoại (<768)

Mỗi dòng bảng thành một thẻ trong khối, padding 16, ngăn bằng viền `--border-divider` (vẫn là bảng với trình đọc màn hình, hàng tiêu đề ẩn). Mỗi thẻ: hàng 1 mã đơn đủ 26 ký tự (mono); hàng 2 ngày đặt (`--fg-muted`) + nhãn trạng thái bên phải; hàng 3 "N món" (`--fg-muted`) + tổng tiền bên phải; cuối là hai nút trên một hàng (nút chuyển chiếm phần rộng, "Huỷ đơn" vừa chữ). Nút phân đoạn rộng hết thanh công cụ, hai mục chia đều.

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

## 3b. Huỷ đơn (ordering.md BR-11, bản sau `v1.0.0`)

1. Bấm "Huỷ đơn" trên dòng (cả hai tab) → `ConfirmDialog` `tone="danger"` (§9.14):
   - tiêu đề "Huỷ đơn này?";
   - nội dung "Đơn {mã} · N món · {tổng tiền}. Hàng được cộng lại vào kho và khách nhận email báo huỷ. Không hoàn tác được.";
   - tab Đang giao thêm câu "Đơn đang giao: báo đơn vị vận chuyển dừng giao.";
   - nút "Giữ đơn" (secondary, focus trước) + "Huỷ đơn" (danger).
2. Bấm "Huỷ đơn" → `DELETE`; nút đổi "Đang huỷ…" (`aria-busy`), chặn bấm lại.
3. Thành công: đóng hộp thoại, tải lại danh sách, focus `h1`, `LiveAnnouncer` "Đã huỷ đơn {8 ký tự cuối}".
4. Lỗi:
   - 409 `CANNOT_CANCEL`: `Alert` warning trong hộp thoại "Đơn đã ở trạng thái {nhãn của currentStatus}, không huỷ được. Danh sách đã được tải lại." rồi tải lại danh sách.
   - 404: `Alert` "Không tìm thấy đơn. Nếu đơn vừa đổi trạng thái, thử lại sau ít giây."
   - 403: chuyển sang màn "không có quyền".
   - Lỗi khác: "Chưa huỷ được đơn. Thử lại sau." Không đóng hộp thoại.

## 4. Trạng thái tải, rỗng, lỗi (§9.12)

- Đang tải: dòng "Đang tải đơn…".
- Rỗng: dòng giữa khối "Không có đơn chờ giao." / "Không có đơn đang giao."
- Lỗi tải: "Chưa tải được danh sách đơn. Tải lại trang để thử lần nữa." (`role="alert"`).

## 5. Không hiện

Địa chỉ giao hàng, họ tên, SĐT, `userId` (API admin không trả, threat model O8). Không có tab "Đã giao", "Đã huỷ" ở rc.1 (contract chỉ cho xem `CONFIRMED`, `SHIPPED`).

## 6. Trợ năng

- Đổi tab là đổi URL nên hai tab là link trong `<nav aria-label="Trạng thái đơn">`, link đang chọn có `aria-current="page"`; không dùng mẫu tab của ARIA (`tablist`, `tab`, `tabpanel`) vì mẫu đó cần phím mũi tên và không đổi URL. Back của trình duyệt quay lại tab trước.
- Bảng ghi vai trò tường minh (`table`, `rowgroup`, `row`, `columnheader`, `cell`) vì điện thoại đổi `display` của dòng, ô sang grid.
- Chuyển đơn thành công: dòng vừa bấm rời danh sách nên focus chuyển lên tiêu đề trang (`h1` có `tabIndex={-1}`).
- Nút trên dòng có nhãn đọc kèm mã đơn: "Chuyển sang Đang giao: đơn {mã}", "Huỷ đơn: đơn {mã}".
- Hộp thoại dùng `<dialog>` mở bằng `showModal()` (giữ focus, Esc đóng), `aria-labelledby` tiêu đề, `aria-describedby` nội dung.
- Chuyển xong đọc câu ngắn qua `LiveAnnouncer`.
