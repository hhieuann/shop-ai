# Màn hình dự kiến

Người viết: Hoàng · Ngày: 06/10/2026 · Cập nhật token: 11/10/2026 (giao diện chàm) · Sửa tham chiếu: 10/11/2026 (trang 404 chuyển sang spec trang)

Các màn hình và trạng thái Black Magic **cần** nhưng **chưa có spec trang riêng** trong [`pages/`](pages/): đăng nhập nhiều bước, trạng thái rỗng, lỗi, admin. Mỗi mục là phương án thiết kế đề xuất, ghép từ component đã có. Khi một màn được chốt và bắt đầu code, chuyển nội dung sang file trong `pages/`.

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
| 1 | Lịch sử đơn `/orders` | đã chốt | [don-hang.md](pages/don-hang.md) mục 3 |
| 2 | Chi tiết đơn `/orders/:orderId` | đã chốt | [don-hang.md](pages/don-hang.md) mục 4 |
| 3 | Hộp thoại xác nhận huỷ đơn | đã chốt | [don-hang.md](pages/don-hang.md) mục 4.5, design-system §9.14 |
| 4 | Sau khi đặt hàng thành công | đã chốt | [don-hang.md](pages/don-hang.md) mục 5 |
| 5 | Nút và menu tài khoản trên header | HIGH / MEDIUM | design-system §9.17 |
| 6 | Nhập mã xác nhận email | MEDIUM | [dang-nhap.md](pages/dang-nhap.md) §3.3 |
| 7 | Nhập mã MFA của admin | MEDIUM | [dang-nhap.md](pages/dang-nhap.md) §3.1 |
| 8 | Lỗi ở form đăng nhập, tạo tài khoản | HIGH | [dang-nhap.md](pages/dang-nhap.md) §4 |
| 9 | Giỏ hàng rỗng | MEDIUM | [gio-hang.md](pages/gio-hang.md) §4 |
| 10 | Tìm kiếm không có kết quả | MEDIUM | [danh-sach-san-pham.md](pages/danh-sach-san-pham.md) §4 |
| 11 | Sản phẩm hết hàng ở trang chi tiết | MEDIUM | [chi-tiet-san-pham.md](pages/chi-tiet-san-pham.md) §4 |
| 12 | Phản hồi sau khi bấm "Thêm vào giỏ" | LOW | [chi-tiet-san-pham.md](pages/chi-tiet-san-pham.md) §3.4 |
| 13 | Khung chờ khi tải | HIGH | design-system §9.12 |
| 14 | Trang 404 | đã chốt | [khong-tim-thay.md](pages/khong-tim-thay.md) |
| 15 | Giao diện điện thoại | MEDIUM | mục Responsive của từng trang |
| 16 | Khung trang admin | LOW | chưa có |
| 17 | Admin: danh sách sản phẩm | LOW | chưa có |
| 18 | Admin: thêm sản phẩm | MEDIUM | chưa có |
| 19 | Admin: danh sách đơn | LOW | chưa có |
| 20 | Admin: chi tiết đơn, đổi trạng thái | MEDIUM | chưa có |

---

## 1–4. Đơn hàng: lịch sử đơn, chi tiết đơn, hộp thoại huỷ đơn, sau khi đặt hàng

Đã chốt 09/11/2026, chuyển sang [pages/don-hang.md](pages/don-hang.md): lịch sử đơn (mục 3), chi tiết đơn (mục 4), hộp thoại huỷ đơn (mục 4.5), thông báo sau khi đặt hàng thành công (mục 5). Khác phương án cũ ở đây: đơn được gọi theo **tên món đầu** ("… và N sản phẩm khác", cần thêm trường `firstItemName` vào danh sách đơn), mã đơn chuyển thành dòng chữ mờ bên dưới; chi tiết đơn có thanh 4 bước trạng thái (design-system §9.26).

## 5. Nút và menu tài khoản trên header

Confidence: HIGH (chưa đăng nhập) · MEDIUM (đã đăng nhập)

Đã chốt ngày 07/10/2026, spec chuẩn ở **design-system §9.17**.

Tóm tắt:
- Nút trên header ghi "Đăng nhập"; đã đăng nhập thì ghi username (rộng bằng chữ "Đăng nhập", tên dài mờ dần). Dưới 1280px chỉ icon.
- Bấm mở bảng ngay dưới nút, vùng dưới header tối lại.
- Chưa đăng nhập: 3 lợi ích, nút "Đăng nhập" + "Tạo tài khoản".
- Đã đăng nhập: "Xin chào", username, email; "Trang quản trị" (chỉ admin); "Đăng xuất". Không lặp "Đơn hàng" (header đã có).
- Header thu gọn (đăng nhập, tạo tài khoản, đặt hàng) không có nút này.

Assumptions: đăng nhập bằng email, username chỉ để hiển thị (chờ An).

Alternatives: đưa "Đơn hàng" vào menu và bỏ khỏi header; nhãn 2 dòng "Xin chào / {username}".

Do not introduce: ảnh đại diện, trang hồ sơ, cài đặt, yêu thích, hỗ trợ.

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

Đã làm (06/10/2026), spec ở gio-hang.md §4: giữ khung hai cột; cột trái `EmptyState` + dải "Hàng mới về"; cột phải `OrderSummary` Tổng cộng 0₫ và nút "Tiếp tục mua sắm" (bấm được, không phải nút vô hiệu). Không hiện widget "Thường mua kèm" (không có món để dựa vào).

Assumptions: giữ khung hai cột để trang không đổi bố cục khi khách thêm món đầu tiên.

Alternatives: `EmptyState` thay cả lưới, không có khối tóm tắt (bản đề xuất trước; đổi theo góp ý của Hoàng).

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

Reuse: design-system §9.12 (gradient `#EEEEEE → #F5F5F5`, 1,6 giây, `aria-hidden`).

Bố cục: mỗi trang vẽ khung chờ đúng kích thước khối thật (đã ghi ở mục Trạng thái của từng spec trang). Lịch sử đơn: 4 dòng cao 72px trong khối danh sách. Chi tiết đơn: 3 khối trái + khối tóm tắt cao 280px.

Assumptions: không có giả định thêm; kích thước khung chờ lấy từ khối thật của từng trang.

Alternatives: vòng xoay (spinner) nhỏ thay cho khung chờ; không chọn vì khung chờ đúng kích thước giúp trang không giật khi dữ liệu về.

## 14. Trang 404

Đã chốt 10/11/2026, chuyển sang [pages/khong-tim-thay.md](pages/khong-tim-thay.md). Giữ phương án ở đây (header đầy đủ, khối rỗng, icon `SearchX`, nút "Về trang chủ" và "Xem tất cả sản phẩm"); câu giải thích thêm gợi ý dùng ô tìm kiếm.

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

Reuse: `MiniHeader` (design-system §9.16), chip (trạng thái ở design-system §6), khung nội dung `--content-max`.

Bố cục và tương tác:
- `MiniHeader` với chữ "Quản trị" 14/20/500 `--fg-subdued` cạnh logo; link bên phải "Về cửa hàng".
- Dưới header một hàng điều hướng 2 chip: "Sản phẩm", "Đơn hàng" (`<nav aria-label="Quản trị">`, mục hiện tại `aria-current="page"`, kiểu chip đang chọn).
- Route giả định: `/admin/products`, `/admin/products/new`, `/admin/orders`, `/admin/orders/:orderId`. Không phải admin → 404 (không lộ trang tồn tại).

Assumptions: route, nhãn và cách chặn quyền đều chờ `admin.md`.

Alternatives: dùng header đầy đủ của cửa hàng và thêm mục "Quản trị"; hoặc thanh điều hướng bên trái kiểu trang quản trị phổ biến. Không chọn vì cả hai đều thêm kiểu điều hướng mà design-system chưa có.

Do not introduce: thanh bên trái kiểu dashboard, biểu đồ doanh thu, thẻ số liệu (chưa có trong phạm vi).

## 17. Admin: danh sách sản phẩm

Confidence: LOW

Reuse: khối 16px, `Badge` (`StockBadge`, `neutral` cho "Đã ẩn"), `Price md`, `Button primary md`, `Button secondary md` "Xem thêm", select "Loại" kiểu ô nhập (design-system §9.4; trang danh sách khách đã đổi sang cột lọc, admin vẫn dùng select cho gọn).

Bố cục và tương tác:
- Hàng tiêu đề: `<h1>` "Sản phẩm" bên trái; bên phải select "Loại" (13 loại) + nút `primary md` "Thêm sản phẩm".
- Bảng trong khối 16px: cột Ảnh (48×48 trên `--bg-subtle`), Tên (+ hãng 12/18), Loại, Giá (căn phải, `tabular-nums`), Tồn kho (căn phải + `StockBadge`), Trạng thái (`Badge`: "Đang bán" success / "Đã ẩn" neutral). Hàng tiêu đề bảng nền `--bg-surface-raised`, chữ 12/18/500 `--fg-subdued`; mỗi hàng cao tối thiểu 56px, ngăn bằng viền `--border-divider`.
- Gồm cả sản phẩm `INACTIVE`.

Assumptions: chưa biết admin có sửa sản phẩm không (`project-plan.md` chỉ ghi "thêm"). Nếu không sửa được thì hàng không bấm được.

Alternatives: lưới `ProductCard` như trang khách thay cho bảng (giống trang khách hơn, nhưng khó so sánh giá và tồn kho giữa nhiều sản phẩm).

Do not introduce: sửa hàng loạt, xuất file, kéo thả sắp xếp.

## 18. Admin: thêm sản phẩm

Confidence: MEDIUM

Reuse: `Field` 48px, select, `CheckoutStep` không đánh số (dat-hang.md §3.1), `Button`, `Alert`, ô ảnh `--bg-subtle`.

Bố cục và tương tác (trường lấy đúng bảng thuộc tính trong `catalog.md`):
- Khối "Thông tin cơ bản": Tên *, Loại * (select 13 loại), Hãng *, Mô tả * (textarea, tối thiểu 4 dòng).
- Khối "Giá và kho": Giá (VND) * (`inputMode="numeric"`, số nguyên, hiện xem trước bằng `Price` bên dưới), Tồn kho *, Trạng thái (2 lựa chọn "Đang bán" / "Ẩn", mặc định "Đang bán").
- Khối "Ảnh": ô URL ảnh + ô xem trước vuông 160px trên `--bg-subtle`.
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
