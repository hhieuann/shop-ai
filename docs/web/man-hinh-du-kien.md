# Màn hình dự kiến

Người viết: Hoàng · Ngày: 06/10/2026

Các màn hình và trạng thái Black Magic **cần** nhưng **chưa có spec trang riêng** trong [`pages/`](pages/): đơn hàng, đăng nhập nhiều bước, trạng thái rỗng, lỗi, 404, admin. Mỗi mục là phương án thiết kế đề xuất, ghép từ component đã có. Khi một màn được chốt và bắt đầu code, chuyển nội dung sang file trong `pages/`.

## Quy tắc

- **Chỉ thiết kế màn hình có trong phạm vi dự án** (`project-plan.md`, `docs/business/`). Những gì không làm: [ngoai-pham-vi.md](ngoai-pham-vi.md).
- **Ghép từ cái đã có**: dùng component trong [design-system.md](design-system.md) và cách làm ở các trang đã có spec. Không thêm màu, kiểu thẻ, kiểu nút hay kiểu chữ mới cho riêng một màn hình.
- Khi có nhiều phương án, chọn phương án **giống nhất với các trang Black Magic đã có spec**.
- Mỗi mục ghi: Confidence, dữ liệu, component dùng lại (Reuse), bố cục và tương tác, giả định (Assumptions), phương án khác (Alternatives), những gì không thêm (Do not introduce).

## Mức tin cậy

| Mức | Nghĩa |
|---|---|
| **HIGH** | Chính component hoặc trạng thái đó đã có ở trang khác; chỉ khác nội dung |
| **MEDIUM** | Mọi phần đều là component đã có, nhưng cách sắp xếp trên màn hình này là đề xuất |
| **LOW** | Không có màn tương tự để đối chiếu, hoặc còn phụ thuộc quyết định nghiệp vụ chưa chốt |

Mục `LOW` phải được người phụ trách duyệt trước khi code.

## Mục lục

| # | Màn hình | Confidence | Spec trang |
|---|---|---|---|
| 1 | Lịch sử đơn `/orders` | MEDIUM | chưa có |
| 2 | Chi tiết đơn `/orders/:orderId` | MEDIUM | chưa có |
| 3 | Hộp thoại xác nhận huỷ đơn | MEDIUM | design-system §9.14 |
| 4 | Sau khi đặt hàng thành công | MEDIUM | chưa có |
| 5 | Header khi đã đăng nhập, đăng xuất | LOW | chưa có |
| 6 | Nhập mã xác nhận email | MEDIUM | [dang-nhap.md](pages/dang-nhap.md) §3.3 |
| 7 | Nhập mã MFA của admin | MEDIUM | [dang-nhap.md](pages/dang-nhap.md) §3.1 |
| 8 | Lỗi ở form đăng nhập, tạo tài khoản | HIGH | [dang-nhap.md](pages/dang-nhap.md) §4 |
| 9 | Giỏ hàng rỗng | MEDIUM | [gio-hang.md](pages/gio-hang.md) §4 |
| 10 | Tìm kiếm không có kết quả | MEDIUM | [danh-sach-san-pham.md](pages/danh-sach-san-pham.md) §4 |
| 11 | Sản phẩm hết hàng ở trang chi tiết | MEDIUM | [chi-tiet-san-pham.md](pages/chi-tiet-san-pham.md) §4 |
| 12 | Phản hồi sau khi bấm "Thêm vào giỏ" | LOW | [chi-tiet-san-pham.md](pages/chi-tiet-san-pham.md) §3.4 |
| 13 | Khung chờ khi tải | HIGH | design-system §9.12 |
| 14 | Trang 404 | LOW | chưa có |
| 15 | Giao diện điện thoại | MEDIUM | mục Responsive của từng trang |
| 16 | Khung trang admin | LOW | chưa có |
| 17 | Admin: danh sách sản phẩm | LOW | chưa có |
| 18 | Admin: thêm sản phẩm | MEDIUM | chưa có |
| 19 | Admin: danh sách đơn | LOW | chưa có |
| 20 | Admin: chi tiết đơn, đổi trạng thái | MEDIUM | chưa có |

---

## 1. Lịch sử đơn `/orders`

Confidence: MEDIUM

Dữ liệu (đã có): `GET /api/v1/orders` trả `OrderSummary` gồm `orderId`, `status`, `totalAmount`, `itemCount`, `createdAt`; phân trang bằng `cursor`. **Không có tên món hay ảnh.**

Reuse:
- Khung hẹp 1280px và tiêu đề trang như giỏ hàng (design-system §5, gio-hang.md §2).
- Khối danh sách có các dòng ngăn bằng viền (gio-hang.md §2).
- `Badge` trạng thái đơn (design-system §9.7), `Price md`, `Button secondary md` "Xem thêm", `EmptyState`.

Patterns:
- Cả dòng bấm được nhờ `::after` phủ kín, chỉ một link thật (như `ProductCard`, design-system §9.9).
- Một hàng tiêu đề trang: `<h1>` 24/32/600.

Bố cục và tương tác:
```
H1 Đơn hàng của tôi
┌ Khối danh sách (bo 16px) ───────────────────────────────────────┐
│ Đơn 01JA8…X4  [Đang giao]                         12.480.000₫  › │
│ Đặt lúc 14:32, 06/10/2026 · 3 sản phẩm                            │
├──────────────────────────────────────────────────────────────────┤
│ Đơn 01J9Z…7Q  [Đã giao]                            8.490.000₫  › │
└──────────────────────────────────────────────────────────────────┘
                         [ Xem thêm đơn ]
```
- Dòng: padding 16px 24px (<640: 16px), lưới `minmax(0,1fr) auto auto`, gap 16px. Cột 1: dòng trên là link "Đơn {orderId}" 16/24/500 (mã `--font-mono`, cắt `…` khi hẹp) + `Badge` trạng thái cách 8px; dòng dưới 12/18 `--fg-subdued` "Đặt lúc {giờ}, {ngày} · {itemCount} sản phẩm". Cột 2: `Price md` tổng. Cột 3: icon `ChevronRight` 20px `--fg-subdued`.
- Hover cả dòng: nền `--bg-surface-raised`. Focus: viền focus quanh dòng.
- Mới nhất ở trên. Còn `nextCursor` → nút `secondary md` "Xem thêm đơn", cách khối 24px.
- Rỗng: `EmptyState` "Bạn chưa có đơn hàng nào." + nút `primary md` "Mua sắm ngay" → `/products`.
- Chưa đăng nhập → `/login` với `from: '/orders'`.

Assumptions:
- Hiện **đầy đủ** `orderId` như code hiện tại (chỉ cắt bằng CSS khi thiếu chỗ), không tự đặt mã ngắn.
- Ngày giờ theo giờ Việt Nam, dạng `HH:mm, dd/MM/yyyy`.
- Không lọc theo trạng thái (nghiệp vụ không có).

Alternatives: thẻ riêng cho từng đơn có viền và cách nhau 24px; không chọn vì giỏ hàng Black Magic đã dùng một khối có dòng ngăn, giữ một kiểu danh sách cho cả hai trang. Bảng nhiều cột: hợp với admin hơn, khó đọc trên điện thoại.

Do not introduce: ảnh món trong dòng (API không có), thanh tìm đơn, bộ lọc, theo dõi vận chuyển, nút "Mua lại".

## 2. Chi tiết đơn `/orders/:orderId`

Confidence: MEDIUM (riêng thanh tiến trình trạng thái: LOW)

Dữ liệu (đã có): `Order` gồm `items[{productId, name, price, quantity}]`, `totalAmount`, `shippingFee` (luôn 0), `status`, `shippingAddress{fullName, phone, address, province}`, `paymentMethod` (COD), `createdAt`, `updatedAt`.

Reuse: bố cục hai cột 360px (design-system §5), khối 16px như `CheckoutStep` không đánh số (dat-hang.md §3.1), `OrderSummary` (§9.15), `Badge`, `Alert`, `Button danger`, `ConfirmDialog` (§9.14).

Patterns: tiêu đề trang + một hàng phụ; nội dung chia khối có `<h2>`; khối tóm tắt cột phải.

Bố cục và tương tác:
```
‹ Đơn hàng của tôi
H1 Đơn 01JA8…X4   [Đang giao]
Đặt lúc 14:32, 06/10/2026
┌ Trạng thái ──────────────────────────────┐ ┌ Thanh toán ─────────────┐
│ ●──────●──────●──────○                    │ │ Tạm tính       …₫       │
│ Chờ xác nhận  Đã xác nhận  Đang giao  Đã giao│ │ Phí vận chuyển Miễn phí │
└──────────────────────────────────────────┘ │ Tổng cộng      …₫       │
┌ Sản phẩm (3) ────────────────────────────┐ │ COD · trả khi nhận hàng │
│ Tên món A                 × 1   8.490.000₫│ │ [ Huỷ đơn ] (danger)    │
└──────────────────────────────────────────┘ └─────────────────────────┘
┌ Giao tới ────────────────────────────────┐
│ Nguyễn Văn A · 0912 345 678              │
│ 12 Lê Lợi, P. Bến Nghé, TP. Hồ Chí Minh  │
└──────────────────────────────────────────┘
```
- Link quay lại "‹ Đơn hàng của tôi" (ghost, như breadcrumb rút gọn ở chi-tiet-san-pham.md §3.1).
- Khối **Trạng thái**: 4 bước `PENDING → CONFIRMED → SHIPPED → DELIVERED`. Bước đã qua và bước hiện tại: chấm 12px `--bg-primary`, vạch nối 4px `--bg-primary`; bước hiện tại thêm vòng 2px `--focus-ring`; bước chưa tới: chấm và vạch `--border-default`. Nhãn 12/18 dưới chấm, bước hiện tại đậm 500 `--fg-default`. Đơn `CANCELLED`: không vẽ thanh, thay bằng `Alert danger` "Đơn đã huỷ lúc {updatedAt}." Dưới 640px thanh chuyển thành danh sách dọc.
- Khối **Sản phẩm**: `<ul>`, mỗi món tên (link tới trang sản phẩm) 14/20, "× {số lượng}" 12/18 `--fg-subdued`, thành tiền 14/20/600 phải. Giá là **giá lúc đặt** (snapshot).
- Khối **Giao tới**: 3 dòng 14/20; tên đậm 500.
- Cột phải `OrderSummary` tiêu đề "Thanh toán". Nút "Huỷ đơn" (`danger lg` rộng 100%) **chỉ hiện** khi `PENDING` hoặc `CONFIRMED` (ordering BR-10); bấm mở `ConfirmDialog` (mục 3). Không có nút `primary` nào trên trang này.
- Lỗi `CANNOT_CANCEL` (đơn vừa chuyển sang đang giao) → `Alert danger` "Đơn đã được giao cho đơn vị vận chuyển, không huỷ được nữa." và tải lại đơn.

Assumptions:
- Thanh tiến trình là LOW: design-system chưa có component này, phải làm mới. Nếu thấy rối thì thay bằng một `Badge` lớn cạnh tiêu đề (đã có sẵn).
- API không trả thời điểm của từng bước, nên thanh không ghi giờ cho từng bước.

Alternatives: chỉ dùng `Badge` lớn cạnh tiêu đề thay cho thanh tiến trình (an toàn hơn, ít thông tin hơn); đặt nút "Huỷ đơn" ở hàng tiêu đề thay vì cột phải.

Do not introduce: theo dõi vận chuyển, hoá đơn, in đơn, "Mua lại", liên hệ hỗ trợ, đổi trả.

## 3. Hộp thoại xác nhận huỷ đơn

Confidence: MEDIUM

Reuse: `ConfirmDialog` đúng như design-system §9.14 (rộng tối đa 480px, bo 16px, padding 24px, `--shadow-lg`, `::backdrop` `--scrim`).

Patterns: một hành động nguy hiểm thì hỏi lại; hai nút căn phải.

Bố cục và tương tác:
- Tiêu đề "Huỷ đơn này?" 20/28/600. Nội dung 14/20 `--fg-muted`: "Đơn {orderId} sẽ bị huỷ và không khôi phục được." Hàng nút: "Giữ đơn" (secondary, nhận focus đầu tiên) + "Huỷ đơn" (danger). Đang huỷ: "Đang huỷ…", hai nút vô hiệu, Esc không đóng.
- Thành công: đóng hộp, khối Trạng thái đổi sang "Đã huỷ", `Alert success` "Đã huỷ đơn." (`role="status"`).

Assumptions: hộp thoại bo **16px** như §9.14 để khớp khối lớn; không thêm biến thể bo khác.

Alternatives: hỏi lại ngay trong trang (nút đổi thành "Bấm lần nữa để huỷ") thay vì hộp thoại; không chọn vì dễ bấm nhầm hai lần liên tiếp và khó hiểu với trình đọc màn hình.

Do not introduce: ô chọn lý do huỷ, ô ghi chú.

## 4. Sau khi đặt hàng thành công

Confidence: MEDIUM

Reuse: trang chi tiết đơn (mục 2) + `Alert success`.

Bố cục và tương tác:
- Không làm trang "Cảm ơn" riêng. Đầu trang chi tiết đơn có `Alert success`: dòng 1 đậm 500 "Đặt hàng thành công!"; dòng 2 "Email xác nhận sẽ được gửi trong ít phút. Thanh toán khi nhận hàng." Focus chuyển vào Alert. Thông báo mất khi tải lại trang (state không còn).
- Đơn vừa tạo đang `PENDING`; thanh trạng thái ở bước đầu.

Assumptions: email do worker gửi sau vài giây (ordering, luồng SQS), nên câu chữ không hứa "đã gửi".

Alternatives: trang "Cảm ơn" riêng `/orders/:id/success` giống trang xác nhận đơn thường gặp ở cửa hàng online ; không chọn vì thêm một trang và code hiện có đã đi thẳng tới chi tiết đơn.

Do not introduce: pháo giấy, gợi ý mua thêm trong thông báo, nút chia sẻ.

## 5. Header khi đã đăng nhập, đăng xuất

Confidence: LOW

Reuse: `NavLink` của header (design-system §9.1).

Bố cục và tương tác:
- Đã đăng nhập: mục "Tài khoản" đổi nhãn thành "Đăng xuất" (icon `LogOut`), bấm thì đăng xuất ngay và về `/`. Không mở menu.
- Chưa đăng nhập: giữ "Tài khoản" → `/login` như hiện tại.

Assumptions: chọn phương án đơn giản nhất vì không có trang tài khoản trong phạm vi. **Cần An quyết** (dang-nhap.md §8) trước khi làm.

Alternatives: menu thả xuống từ mục "Tài khoản" chứa "Đơn hàng" và "Đăng xuất"; giữ "Tài khoản" và thêm link "Đăng xuất" riêng trong footer.

Do not introduce: menu thả xuống tài khoản, ảnh đại diện, trang hồ sơ.

## 6. Nhập mã xác nhận email

Confidence: MEDIUM

Reuse: thẻ và `FocusLayout` của dang-nhap.md §2, `Field` 48px, `Button primary lg`, `Button ghost md`.

Bố cục và tương tác: như dang-nhap.md §3.3 (tiêu đề, một ô mã 6 số, nút "Xác nhận", nút ghost "Gửi lại mã" bên dưới, căn giữa).

Assumptions: Cognito gửi mã 6 số qua email (cần An xác nhận). Một ô thay vì 6 ô riêng vì dùng lại được `Field` có sẵn và dán mã dễ hơn.

Alternatives: 6 ô nhập tách riêng cho từng số; trang riêng `/register/verify` thay vì đổi bước trong cùng trang.

## 7. Nhập mã MFA của admin

Confidence: MEDIUM

Bố cục và tương tác: dùng y hệt mục 6, tiêu đề "Xác thực hai lớp", không có "Gửi lại mã" nếu dùng ứng dụng xác thực. Một nút chính "Xác nhận".

Assumptions: loại MFA do An chọn; nếu là SMS thì thêm "Gửi lại mã" như mục 6.

Alternatives: dùng chung trang với bước 6 nhưng thêm ô "Ghi nhớ thiết bị này" nếu Cognito bật tính năng nhớ thiết bị (chưa có trong tài liệu).

## 8. Lỗi ở form đăng nhập, tạo tài khoản

Confidence: HIGH

Reuse: `Field` trạng thái lỗi (design-system §9.4, có icon `CircleAlert` 16px), `Alert danger` cho lỗi chung.

Bố cục và tương tác: như dang-nhap.md §4. Lỗi gắn với một ô → dưới ô; lỗi chung (sai email/mật khẩu, quá nhiều lần thử) → `Alert` đầu form.

Assumptions: Cognito trả mã lỗi đủ để phân biệt lỗi của từng ô (dang-nhap.md §4).

Alternatives: chỉ báo lỗi chung bằng `Alert` cho mọi trường hợp, không gắn vào từng ô; đơn giản hơn nhưng khách khó biết sửa ô nào.

## 9. Giỏ hàng rỗng

Confidence: MEDIUM

Reuse: `EmptyState` (design-system §9.12).

Bố cục và tương tác: như gio-hang.md §4: giữ tiêu đề "Giỏ hàng", thay lưới hai cột bằng `EmptyState` (icon `ShoppingCart` 48px, một câu, nút `primary md` "Mua sắm ngay"). Không hiện khối tóm tắt, không hiện widget "Thường mua kèm" (không có món để dựa vào).

Assumptions: một nút duy nhất dẫn về danh sách sản phẩm.

Alternatives: giữ khung hai cột với khối tóm tắt ghi 0₫ và nút vô hiệu; không chọn vì hiện một nút không bấm được là thừa.

## 10. Tìm kiếm không có kết quả

Confidence: MEDIUM

Reuse: tiêu đề trang danh sách + `EmptyState` (danh-sach-san-pham.md §4).

Bố cục và tương tác: giữ tiêu đề "Kết quả cho “{q}”" và hai select; thay lưới bằng `EmptyState` "Không có sản phẩm nào có “{q}” trong tên." + link "Xem tất cả sản phẩm".

Assumptions: không có gợi ý tìm kiếm vì API không hỗ trợ.

Alternatives: hiện thêm dải "Hàng mới về" dưới thông báo rỗng để khách có chỗ đi tiếp; có thể thêm sau mà không đổi giao diện vì `ProductRail` đã có.

Do not introduce: gợi ý sửa chính tả, "Có phải bạn muốn tìm", từ khoá phổ biến.

## 11. Sản phẩm hết hàng ở trang chi tiết

Confidence: MEDIUM

Reuse: `StockBadge` "Hết hàng", `Button secondary lg` vô hiệu.

Bố cục và tương tác: như chi-tiet-san-pham.md §4: giữ nguyên hộp mua, `Badge danger` "Hết hàng", ẩn bộ chọn số lượng, nút "Thêm vào giỏ" đổi thành nút phụ vô hiệu "Hết hàng". Ô ảnh mờ 0,6.

Assumptions: API vẫn trả sản phẩm `ACTIVE` có `stock = 0` (catalog: hết hàng vẫn hiển thị).

Alternatives: ẩn hẳn khối số lượng và nút, chỉ để nhãn "Hết hàng"; không chọn vì giữ chỗ cho nút thì hộp mua không đổi bố cục giữa còn hàng và hết hàng.

Do not introduce: "Báo khi có hàng" (nghiệp vụ không có).

## 12. Phản hồi sau khi bấm "Thêm vào giỏ"

Confidence: LOW

Reuse: `Alert success` dưới nút (chi-tiet-san-pham.md §3.4).

Bố cục và tương tác: thông báo nằm ngay dưới nút, `role="status"`, có link "Xem giỏ hàng"; trang không chuyển đi, không mở hộp thoại.

Assumptions: chọn thông báo tại chỗ vì dùng lại `Alert` có sẵn và khách vẫn ở lại trang để mua tiếp. Chấm đếm số món trên header **không làm** vì nghiệp vụ không nhắc; nếu muốn thêm thì sửa header (design-system §9.1) trước.

Alternatives: hộp thoại xác nhận "Đã thêm vào giỏ" có nút "Xem giỏ" / "Mua tiếp"; ngăn kéo giỏ hàng bên phải. Cả hai đều thêm một kiểu hộp mới mà design-system chưa có.

Do not introduce: ngăn kéo giỏ hàng, hộp thoại "Đã thêm" kèm sản phẩm gợi ý.

## 13. Khung chờ khi tải

Confidence: HIGH

Reuse: design-system §9.12 (gradient `#EFEAFB → #F7F5FC`, 1,6 giây, `aria-hidden`).

Bố cục: mỗi trang vẽ khung chờ đúng kích thước khối thật (đã ghi ở mục Trạng thái của từng spec trang). Lịch sử đơn: 4 dòng cao 72px trong khối danh sách. Chi tiết đơn: 3 khối trái + khối tóm tắt cao 280px.

Assumptions: không có giả định thêm; kích thước khung chờ lấy từ khối thật của từng trang.

Alternatives: vòng xoay (spinner) nhỏ thay cho khung chờ; không chọn vì khung chờ đúng kích thước giúp trang không giật khi dữ liệu về.

## 14. Trang 404

Confidence: LOW

Reuse: `RootLayout` (header đầy đủ để khách tìm tiếp), `EmptyState`.

Bố cục và tương tác: `EmptyState` giữa trang, icon `SearchX` 48px, `<h1>` 24/32/600 "Không tìm thấy trang", câu "Đường dẫn có thể đã sai hoặc trang đã bị gỡ.", nút `primary md` "Về trang chủ" + link "Xem tất cả sản phẩm".

Assumptions: router đã có `NotFoundPage` cho đường dẫn lạ; trang dùng `RootLayout` như mọi trang khách.

Alternatives: chỉ một dòng chữ và link về trang chủ, không dùng `EmptyState`; hoặc hiện thêm dải "Hàng mới về".

Do not introduce: hình minh hoạ lớn, trò chơi, ô tìm kiếm riêng (header đã có).

## 15. Giao diện điện thoại

Confidence: MEDIUM

Reuse: mục Responsive trong từng spec trang; `--shadow-up` (design-system §10).

Bố cục (chung cho mọi trang):
- Dưới 960px mọi bố cục hai cột thành một cột; cột phụ (hộp mua, tóm tắt) xuống dưới nội dung chính.
- Dưới 640px: padding khối 16px; ô nhập chữ 16px; nút chính rộng 100%; giỏ hàng dùng thanh tổng dính đáy.
- Bảng (admin) dưới 640px thành danh sách thẻ, mỗi ô một dòng "nhãn: giá trị".

Assumptions: chỉ dùng media query, không có bản dựng riêng cho điện thoại.

Alternatives: giữ khối tóm tắt đầy đủ ở cuối trang trên điện thoại thay cho thanh dính đáy (đơn giản hơn nhưng khách phải cuộn xuống mới thấy nút).

---

## 16. Khung trang admin

Confidence: LOW

Phạm vi (đã có trong tài liệu): `project-plan.md` "Admin cơ bản: thêm sản phẩm, xem đơn"; `ordering.md` admin chuyển `SHIPPED`, `DELIVERED` và huỷ đơn (BR-11); `dynamodb-design.md` admin xem cả sản phẩm `INACTIVE` và lọc đơn theo trạng thái. **Chưa có** `docs/business/admin.md`.

Reuse: `MiniHeader` (design-system §9.16), chip của header (§9.1), khung nội dung `--content-max`.

Bố cục và tương tác:
- `MiniHeader` với chữ "Quản trị" 14/20/500 `--fg-subdued` cạnh logo; link bên phải "Về cửa hàng".
- Dưới header một hàng điều hướng 2 chip: "Sản phẩm", "Đơn hàng" (`<nav aria-label="Quản trị">`, mục hiện tại `aria-current="page"`, kiểu chip đang chọn).
- Route giả định: `/admin/products`, `/admin/products/new`, `/admin/orders`, `/admin/orders/:orderId`. Không phải admin → 404 (không lộ trang tồn tại).

Assumptions: route, nhãn và cách chặn quyền đều chờ `admin.md`.

Alternatives: dùng header đầy đủ của cửa hàng và thêm mục "Quản trị"; hoặc thanh điều hướng bên trái kiểu trang quản trị phổ biến. Không chọn vì cả hai đều thêm kiểu điều hướng mà design-system chưa có.

Do not introduce: thanh bên trái kiểu dashboard, biểu đồ doanh thu, thẻ số liệu (chưa có trong phạm vi).

## 17. Admin: danh sách sản phẩm

Confidence: LOW

Reuse: khối 16px, `Badge` (`StockBadge`, `neutral` cho "Đã ẩn"), `Price md`, `Button primary md`, `Button secondary md` "Xem thêm", select "Loại" của trang danh sách.

Bố cục và tương tác:
- Hàng tiêu đề: `<h1>` "Sản phẩm" bên trái; bên phải select "Loại" (13 loại) + nút `primary md` "Thêm sản phẩm".
- Bảng trong khối 16px: cột Ảnh (48×48 trên `--bg-image-plate`), Tên (+ hãng 12/18), Loại, Giá (căn phải, `tabular-nums`), Tồn kho (căn phải + `StockBadge`), Trạng thái (`Badge`: "Đang bán" success / "Đã ẩn" neutral). Hàng tiêu đề bảng nền `--bg-surface-raised`, chữ 12/18/500 `--fg-subdued`; mỗi hàng cao tối thiểu 56px, ngăn bằng viền `--border-divider`.
- Gồm cả sản phẩm `INACTIVE`.

Assumptions: chưa biết admin có sửa sản phẩm không (`project-plan.md` chỉ ghi "thêm"). Nếu không sửa được thì hàng không bấm được.

Alternatives: lưới `ProductCard` như trang khách thay cho bảng (giống trang khách hơn, nhưng khó so sánh giá và tồn kho giữa nhiều sản phẩm).

Do not introduce: sửa hàng loạt, xuất file, kéo thả sắp xếp.

## 18. Admin: thêm sản phẩm

Confidence: MEDIUM

Reuse: `Field` 48px, select, `CheckoutStep` không đánh số (dat-hang.md §3.1), `Button`, `Alert`, ô ảnh `--bg-image-plate`.

Bố cục và tương tác (trường lấy đúng bảng thuộc tính trong `catalog.md`):
- Khối "Thông tin cơ bản": Tên *, Loại * (select 13 loại), Hãng *, Mô tả * (textarea, tối thiểu 4 dòng).
- Khối "Giá và kho": Giá (VND) * (`inputMode="numeric"`, số nguyên, hiện xem trước bằng `Price` bên dưới), Tồn kho *, Trạng thái (2 lựa chọn "Đang bán" / "Ẩn", mặc định "Đang bán").
- Khối "Ảnh": ô URL ảnh + ô xem trước vuông 160px trên `--bg-image-plate`.
- Khối "Thông số kỹ thuật": danh sách dòng `[Tên thông số][Giá trị][Xoá]` + nút `ghost md` "Thêm dòng".
- Hai cột từ 960px: form trái, cột phải 360px là khối xem trước dùng `ProductCard` thật. Nút `primary lg` "Lưu sản phẩm" cuối form; "Huỷ" là link về danh sách.

Assumptions: ảnh nhập bằng URL vì chưa có nghiệp vụ tải ảnh lên; nếu An làm upload S3 thì thay ô URL bằng ô chọn file.

Alternatives: form một cột không có khối xem trước (đơn giản hơn); chia thành nhiều bước có số thứ tự như trang đặt hàng (dat-hang.md §3.1), hợp nếu form dài thêm.

Do not introduce: trình soạn thảo văn bản định dạng, biến thể, giảm giá, SEO.

## 19. Admin: danh sách đơn

Confidence: LOW

Reuse: chip, bảng của mục 17, `Badge` trạng thái đơn, `Price md`.

Bố cục và tương tác:
- `<h1>` "Đơn hàng"; dưới là hàng chip trạng thái (Chờ xác nhận, Đã xác nhận, Đang giao, Đã giao, Đã huỷ), chọn một chip một lúc, mặc định "Chờ xác nhận"; trạng thái đang xem nằm trên URL (`?status=`).
- Bảng: Mã đơn (mono), Thời gian đặt, Khách (họ tên + SĐT), Số món, Tổng (căn phải), Trạng thái. Mới nhất ở trên. "Xem thêm" khi còn trang sau. Cả hàng bấm được → chi tiết.

Assumptions: lọc theo **một** trạng thái vì truy vấn Q3 trong `dynamodb-design.md` đi theo `status`; chưa biết có cần "Tất cả".

Alternatives: danh sách dòng giống lịch sử đơn của khách (mục 1) thay cho bảng; thêm chip "Tất cả" nếu `admin.md` cần.

Do not introduce: biểu đồ, xuất file, chọn nhiều đơn.

## 20. Admin: chi tiết đơn, đổi trạng thái

Confidence: MEDIUM

Reuse: toàn bộ mục 2 + `ConfirmDialog`.

Bố cục và tương tác:
- Giống mục 2, thêm tên tài khoản khách (`userId`) trong khối "Giao tới".
- Cột phải dưới `OrderSummary`: **một** nút `primary lg` cho bước tiếp theo theo máy trạng thái: `CONFIRMED` → "Chuyển sang Đang giao"; `SHIPPED` → "Xác nhận Đã giao". `PENDING` và trạng thái cuối không có nút này.
- Nút `danger lg` "Huỷ đơn" khi `PENDING`, `CONFIRMED` hoặc `SHIPPED` (BR-11); hộp thoại ghi rõ "Tồn kho sẽ được hoàn lại." (BR-12).
- Mọi đổi trạng thái đều qua `ConfirmDialog`; xong thì `Alert success` và tải lại đơn.

Assumptions: admin không tự chuyển `PENDING → CONFIRMED` (worker làm); đơn kẹt ở `PENDING` xử lý theo runbook `dlq-orders.md`, giao diện không có nút riêng.

Alternatives: các nút đổi trạng thái đặt ở hàng tiêu đề; đổi trạng thái bằng select + nút "Lưu" (linh hoạt hơn nhưng dễ chọn sai bước trong máy trạng thái).

Do not introduce: sửa món trong đơn, sửa địa chỉ, hoàn tiền.

---

## Không thiết kế

Các màn sau không có trong phạm vi nên **không thiết kế**: trang tổng quan tài khoản, sổ địa chỉ, phương thức thanh toán, thẻ và điểm thưởng, hội viên, danh sách đã lưu, theo dõi vận chuyển, đổi trả, bảo hành, chọn cách nhận hàng, số điện thoại khôi phục, passkey. Lý do từng mục: [ngoai-pham-vi.md](ngoai-pham-vi.md). Muốn làm một mục: viết tài liệu nghiệp vụ trước, rồi mới thêm vào file này.
