# Quản trị sản phẩm `/admin/products`

Chốt 25/11/2026 (#543). Nghiệp vụ: [catalog.md](../../business/catalog.md) mục "Admin quản lý sản phẩm" (BR-09 … BR-15). API: `/api/v1/admin/products` (contracts/openapi.yaml, tag `admin`). Khung: design-system §9.29 (`AdminLayout`). Đọc kèm [design-system.md](../design-system.md).

Người làm: **Hoàng**. Danh sách (mục 2) đã làm ở #548: `features/admin/pages/AdminProductsPage.tsx`, bộ lọc trên URL `features/admin/lib/adminProductFilters.ts`. Thêm, sửa (mục 3) đã làm ở #549: `features/admin/pages/AdminProductFormPage.tsx`, luật form `features/admin/lib/productForm.ts`, mẫu `features/admin/lib/productTemplates.ts`, `features/admin/components/CopyFromPanel.tsx`, `ImagePreview.tsx`. Component dùng chung (#547, design-system §9.30–9.33): `Select`, `Switch`, `ActionMenu` (nút ba chấm), `ToastProvider` (thông báo nổi).

## 1. Ai thấy gì

Như trang đơn hàng admin (admin-don-hang.md mục 1): khung quản trị kiểm đăng nhập, nhóm `admin`, xác thực hai lớp. API trả 403 thì hiện khối không có quyền. Mục "Sản phẩm" (nhóm "Danh mục") của cột trái hiện khi trang này có (`ready: true` trong `AdminLayout`).

## 2. Danh sách `/admin/products`

### Đầu trang
- H1 "Sản phẩm" 24/32/700; dòng phụ 14/18 `--fg-muted`: "Thêm, sửa, ẩn sản phẩm của từng loại. Món ẩn hoặc đã xoá khách không thấy."
- Bên phải: nút `primary` "Thêm sản phẩm" (icon `Plus`) → `/admin/products/new?category=<loại đang xem>`. Điện thoại: nút rộng hết, dưới dòng phụ.

### Khối danh sách
Một khối như trang đơn admin (nền `--bg-surface`, viền, bo `--radius-xl`).

**Thanh công cụ** (padding `12px 16px`, viền dưới; điện thoại xếp dọc, mỗi ô rộng hết):
- Ô tìm theo tên (icon `Search`, 260px, `maxLength` 30); gửi khi Enter hoặc ngừng gõ 300 ms; rỗng thì bỏ `q`.
- `Select` loại hàng (200px), 13 loại theo nhãn tiếng Việt của menu danh mục; mặc định Laptop.
- Nút phân đoạn (kiểu trang đơn admin) sát phải: **Tất cả**, **Đang bán**, **Đã ẩn**, **Đã xoá**, mỗi mục kèm số đếm từ `counts` (Tất cả = đang bán + đã ẩn) trong viên nhỏ 12px. Điện thoại: rộng hết, cuộn ngang khi tràn.
- URL là nguồn sự thật: `?category=gpu&status=INACTIVE&q=rtx&page=2` (cursor trang trước trong `location.state` như trang đơn admin). "Tất cả" là bỏ `status`.

**Bảng** (hàng tiêu đề và ô như trang đơn admin):

| Cột | Nội dung |
|---|---|
| Sản phẩm | ảnh 40×40 bo `--radius-lg` (chưa có ảnh: ô `--bg-subtle`), tên 14/20/600 `--fg-heading`, hãng 12/16 `--fg-subdued` |
| Loại | nhãn tiếng Việt, `--fg-muted` |
| Giá bán | `Price` đậm, căn phải |
| Tồn kho | số, căn phải; 1–3 chữ `--fg-warning` 600; 0 là "Hết hàng" `--fg-danger` 600 |
| Trạng thái | viên có chấm (như trang đơn admin): "Đang bán" success, "Đã ẩn" neutral (`--bg-subtle`, `--fg-muted`), "Đã xoá" danger |
| (thao tác) | xem dưới |

**Thao tác trên dòng** (căn phải):
- Món đang bán hoặc đã ẩn:
  - nút icon `Pencil` 32×32 "Sửa" (link `/admin/products/:id/edit`, `aria-label` "Sửa: {tên}");
  - `ActionMenu` nút `MoreHorizontal` 32×32 ("Thao tác khác: {tên}") mở menu rộng 220px (nền trắng, bo `--radius-xl`, `--shadow-lg`): **Sửa** · **Nhân bản** (→ `/admin/products/new?from=<id>`) · **Ẩn khỏi cửa hàng** hoặc **Hiện lại** · vạch · **Xoá** (chữ và icon `--fg-danger`).
- Món đã xoá: chỉ nút phụ `sm` "Khôi phục".

**Chân khối:** "Hiện N sản phẩm" bên trái, `CursorPager` bên phải.

### Thao tác
- **Ẩn, hiện lại:** `PATCH { status, updatedAt }` ngay, không hỏi lại. Xong: `Toast` "Đã ẩn "{tên}" khỏi cửa hàng." / "Đã hiện lại "{tên}"."; tải lại danh sách và `counts`.
- **Xoá:** `ConfirmDialog tone="danger"`:
  - trong nội dung hộp, bên trái câu giải thích là ô tròn 40px `--bg-danger-tint` có icon `Trash2` `--fg-danger` (`ConfirmDialog` chưa có chỗ đặt icon riêng nên không đặt trên tiêu đề);
  - tiêu đề "Xoá sản phẩm này?";
  - nội dung "{tên} sẽ không hiện ở cửa hàng nữa. Đơn cũ vẫn giữ món này. Bạn có thể khôi phục ở mục "Đã xoá"";
  - nút "Giữ lại" (focus trước) + "Xoá sản phẩm" (danger).
  Xong: `DELETE` → 204, `Toast` "Đã xoá "{tên}".", tải lại.
- **Khôi phục:** `POST .../restore`, `Toast` "Đã khôi phục "{tên}". Sản phẩm đang ở trạng thái đã ẩn.", tải lại.
- Lỗi:
  - 409 `PRODUCT_CHANGED`: `Toast` "Sản phẩm vừa được sửa ở nơi khác. Danh sách đã được tải lại.";
  - 404: `Toast` "Không tìm thấy sản phẩm. Danh sách đã được tải lại.";
  - 403: khối không có quyền;
  - lỗi khác: `Toast` "Chưa lưu được. Thử lại sau." (giữ danh sách).
  Đang gửi một thao tác thì khoá nút của dòng đó.

### `Toast`
Góc dưới phải, cách mép 24px (điện thoại: rộng hết, cách mép 16px). Nền `--fg-heading`, chữ `--fg-on-primary` 14/20/500, bo `--radius-xl`, `--shadow-lg`, có nút đóng. `role="status"`, tự ẩn sau 5 giây; rê chuột hoặc có focus thì giữ. Không dời focus.

### Tải, rỗng, lỗi
- Đang tải: dòng "Đang tải sản phẩm…" giữa khối.
- Rỗng theo bộ lọc:
  - "Chưa có sản phẩm nào trong loại này." kèm link "Thêm sản phẩm";
  - có `q`: "Không có sản phẩm khớp "{q}".";
  - Đã xoá: "Chưa xoá sản phẩm nào."
- Lỗi tải: "Chưa tải được danh sách sản phẩm. Tải lại trang để thử lần nữa." (`role="alert"`).

### Điện thoại (<768)
Như trang đơn admin: mỗi dòng thành thẻ trong khối.
- Hàng 1: ảnh, tên, hãng.
- Hàng 2: giá bên trái, "Tồn kho: N" bên phải.
- Hàng 3: nhãn trạng thái bên trái, hai nút icon bên phải.
- Cột Loại ẩn (đã chọn ở thanh công cụ).

## 3. Thêm `/admin/products/new`, sửa `/admin/products/:productId/edit`

### Đầu trang
- H1 "Thêm sản phẩm" hoặc tên sản phẩm (trang sửa) + dòng phụ. Trang sửa có nhãn trạng thái cạnh H1.
- Góc phải tiêu đề (chỉ trang thêm): nút phụ "Sao chép từ sản phẩm có sẵn" (icon `Copy`). Bấm thì mở một khối ngay dưới tiêu đề (không phải hộp thoại): ô chọn các món của loại đang chọn (tối đa 50 món mới nhất, đang bán và đã ẩn) và nút "Điền từ sản phẩm này"; chọn một món thì điền mọi ô **trừ tên, giá, tồn kho và ảnh** (các ô này để trống cho admin nhập).

### Bố cục
Lưới `minmax(0,1fr) | 360px`, cách 24px; dưới 960px một cột (cột phải xuống dưới). Mỗi khối: nền trắng, viền `--border-divider`, bo `--radius-xl`, padding 20, tiêu đề khối 16/24/600, các khối cách nhau 16px.

**Cột trái:**
1. **Loại hàng** (chỉ trang thêm; trang sửa hiện tên loại, không đổi được, BR-12):
   - 13 chip (kiểu chip đang chọn §6), chọn một;
   - chọn loại thì điền mẫu của loại đó và hiện dải "Đã điền mẫu {loại}. Sửa lại tên, giá, tồn kho và thông số cho đúng." (nền `--bg-primary-tint`, chữ `--fg-primary`, bo `--radius-lg`) với nút phụ `sm` "Xoá mẫu" (xoá mọi ô về rỗng, giữ loại);
   - đổi loại khi đã sửa một ô bất kỳ thì hỏi lại bằng `ConfirmDialog` "Đổi loại hàng? Các ô đã nhập sẽ được thay bằng mẫu của {loại mới}." trước khi thay;
   - `?category=` từ danh sách chọn sẵn loại; `?from=<id>` (Nhân bản) điền giống hệt "Sao chép từ sản phẩm có sẵn": mọi ô trừ tên, giá, tồn kho và ảnh.
2. **Thông tin chung:** Tên sản phẩm (placeholder ví dụ của mẫu), Hãng, Mô tả (ô nhiều dòng, gợi ý "2–3 câu: dành cho ai, điểm nổi bật, nên mua kèm gì. Tối đa 1000 ký tự.", đếm ký tự).
3. **Giá và tồn kho:** hai ô cạnh nhau (điện thoại xếp dọc): "Giá bán (₫)" (nhập số, hiện dấu chấm ngăn nghìn khi rời ô), "Tồn kho". Mẫu để trống hai ô này.
4. **Thông số:** lưới 2 cột (điện thoại 1 cột), mỗi ô một khoá theo `SPEC_ORDER` của loại, nhãn từ bảng nhãn thông số của trang chi tiết. Ô rỗng thì không gửi khoá đó.

**Cột phải:**
1. **Đang bán:** `Switch` (mặc định bật). Gợi ý "Tắt để lưu ở trạng thái đã ẩn".
2. **Ảnh** (catalog.md BR-16): nút phân đoạn hai lựa chọn "Tải ảnh lên" (mặc định) và "Dán đường dẫn" (nhóm radio, mũi tên trái phải đổi lựa chọn). Trang sửa có ảnh https không nằm trong bucket ảnh (không có `/images/products/`) thì mở sẵn "Dán đường dẫn".
   - **Tải ảnh lên:** khung 4:3 (`--bg-subtle`, bo `--radius-lg`) cũng là vùng kéo thả.
     - Chưa có ảnh: viền đứt `--border-input`, icon `ImagePlus`, "Kéo ảnh vào đây hoặc", nút phụ `sm` "Tải ảnh từ máy" (nút thật, dùng được bằng bàn phím), dòng mờ "JPG, PNG hoặc WebP, tối đa 3 MB". Kéo tệp vào: viền đứt 2px `--border-primary`, nền `--bg-primary-tint`.
     - Kiểm ở web trước khi xin vé: chỉ JPG/JPEG, PNG, WebP ("Chỉ nhận ảnh JPG, PNG hoặc WebP."), không rỗng, tối đa 3 MB ("Ảnh tối đa 3 MB. Chọn ảnh nhỏ hơn.").
     - Đang tải: ảnh của tệp mờ 40%, giữa khung "Đang tải ảnh… N%" và thanh tiến độ (`--bg-primary`, `role="progressbar"`). "Lưu sản phẩm" bị khoá, cạnh nút có câu "Chờ tải ảnh xong rồi lưu.".
     - Có ảnh: ảnh `contain`, dưới khung nút phụ `sm` "Đổi ảnh".
     - Nút X tròn 32px ở góc phải trên khung (`aria-label` "Bỏ ảnh này", nền trắng mờ, `--shadow-glass`): đang tải thì huỷ lượt tải; đã có ảnh thì bỏ ảnh khỏi form (trang sửa: lưu gửi `imageUrl: null`). Tệp đã lên bucket nhưng bị bỏ thì chưa tự xoá (catalog.md giới hạn đã biết).
     - Lỗi mạng, API vé hoặc S3 từ chối: "Chưa tải được ảnh. Thử lại." dưới khung (`--fg-danger`, `role="alert"`), ảnh đang có giữ nguyên.
   - **Dán đường dẫn:** ô "Đường dẫn ảnh (https)" + khung xem 4:3 ("Chưa có ảnh"; ảnh tải lỗi thì "Không tải được ảnh từ đường dẫn này").
   - Đổi lựa chọn khi đang tải thì huỷ lượt tải; giá trị ảnh dùng chung cho hai lựa chọn.
3. **Xem trước:** thẻ sản phẩm như ở cửa hàng (`ProductCard`), đổi theo ô đang nhập.

**Thanh cuối trang:** dính đáy, nền trắng, viền trên, nút "Huỷ" (secondary, về danh sách) + "Lưu sản phẩm" (primary). Điện thoại: hai nút chia đều. Đang gửi: "Đang lưu…" (`aria-busy`), khoá nút (bấm hai lần có thể tạo hai món, BR-11).

### Kiểm và lỗi
- Kiểm ở web theo BR-11 khi rời ô và khi bấm Lưu; lỗi hiện dưới ô (`Field` error), focus ô lỗi đầu tiên. Lỗi 400 từ API gắn vào ô theo `errors[].field`.
- Thêm xong: sang `/admin/products/:id/edit` của món mới, `Toast` "Đã thêm "{tên}"."
- Sửa xong: ở lại, `Toast` "Đã lưu thay đổi.", cập nhật `updatedAt` và `expectedStock` mới.
- 409 `STOCK_CHANGED`: `Alert` warning trên thanh cuối "Tồn kho vừa đổi thành {N} (có thể do khách vừa đặt hàng). Kiểm lại số tồn kho rồi lưu lại."; ô tồn kho giữ số admin nhập, `expectedStock` cập nhật theo N.
- 409 `PRODUCT_CHANGED`: `ConfirmDialog` "Sản phẩm vừa được sửa ở nơi khác" với "Tải bản mới" (mất phần đang sửa) và "Ở lại".
- Món đã xoá (GET có `deletedAt`): khối báo "Sản phẩm này đã bị xoá." + nút "Khôi phục"; form chỉ đọc.
- Rời trang khi có thay đổi chưa lưu: hỏi "Rời trang? Các thay đổi chưa lưu sẽ mất."

## 4. Mẫu theo loại hàng

`features/admin/lib/productTemplates.ts`: 13 mẫu tĩnh, mỗi loại một mẫu.
- Mỗi mẫu có hãng gợi ý, placeholder tên ví dụ, mô tả 2–3 câu theo giọng các món demo, đủ khoá thông số theo `SPEC_ORDER` với giá trị ví dụ.
- **Tên, giá, tồn kho để trống.** Không có ảnh.
- Mẫu không gọi API.

## 5. Không làm

Thu nhỏ, cắt, chuyển định dạng ảnh; nhiều ảnh mỗi món; tự xoá ảnh không dùng; đổi loại hàng của món đã có, xoá hẳn, sửa nhiều món một lúc, nhập từ file, lịch sử thay đổi.

## 6. Trợ năng

- Nút phân đoạn là link trong `<nav aria-label="Trạng thái sản phẩm">` (`aria-current`), như trang đơn admin.
- `ActionMenu`:
  - `aria-haspopup="menu"`, `aria-expanded`; menu `role="menu"`, mục `role="menuitem"`;
  - mũi tên lên, xuống đi giữa mục; Home, End; Esc đóng và trả focus về nút;
  - chọn mục thì đóng.
- Nút icon có `aria-label` kèm tên sản phẩm.
- `Switch` là `<button role="switch" aria-checked>` có nhãn.
- Chip loại hàng là nhóm radio (`role="radiogroup"`).
- Sau khi ẩn, xoá, khôi phục: focus về nút ba chấm của dòng nếu dòng còn; dòng đã rời danh sách thì focus về H1.

## 7. Ảnh mẫu

`pr-drafts/admin-san-pham/anh/` (máy Hoàng):
- 01 danh sách 1440 có thông báo nổi;
- 02 menu ba chấm 1366;
- 03 hộp xoá 1366;
- 04 lọc Đã xoá 1366;
- 05 trang thêm có mẫu 1440;
- 06 danh sách 390;
- 07 trang thêm 390.

Spec là chuẩn, ảnh chỉ để nhìn bố cục.
