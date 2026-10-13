# Danh sách và kết quả tìm kiếm `/products`

Code: `features/catalog/pages/ProductListPage.tsx`, `features/catalog/lib/productFilters.ts`, `features/catalog/components/` (`ProductListCard`, `FilterPanel`, `FilterSheet`), `features/cart/components/AddToCartButton.tsx`. Nghiệp vụ: `docs/business/catalog.md` (BR-01, BR-02, BR-03, BR-04, BR-08), `docs/business/cart.md` (BR-01 … BR-04, cho nút thêm vào giỏ). Đọc kèm [design-system.md](../design-system.md) §4 (Thanh cuộn), §9.5, §9.8, §9.19–§9.23.

Bản chốt 13/10/2026 (thay bản 06/10). **Code chưa đổi**: trang hiện tại vẫn là bản cũ (select "Loại", nút "Xem thêm sản phẩm"). Một trang cho cả ba trường hợp: xem tất cả, xem theo loại hàng, xem kết quả tìm kiếm.

Bản chốt đúng nghiệp vụ và API hiện tại, chỉ thêm `specs` vào mỗi sản phẩm của danh sách (§1). Lọc nhiều nhóm và "Tìm thấy N sản phẩm" để Sprint 2 (§8).

## 1. Đường dẫn và dữ liệu

- **URL là nguồn sự thật** của bộ lọc và trang đang xem: `/products?q=rtx&category=gpu&sort=price_asc&cursor=…&page=2`. Chia sẻ link và F5 không mất. Tham số rỗng hoặc mặc định thì xoá khỏi URL.
- `q`: từ khoá **nhập ở ô tìm kiếm trên header** (không có ô tìm riêng trong trang), 1–30 ký tự sau khi bỏ khoảng trắng; rỗng thì không gửi.
- `category`: 1 trong 13 loại (`CATEGORIES`). Giá trị lạ trên URL bị bỏ qua.
- `sort`: `newest` (mặc định, không ghi lên URL), `price_asc`, `price_desc`. Hết hàng luôn nằm cuối (server lo).
- `cursor`: cursor của trang đang xem (chính là `nextCursor` của trang trước); không có là trang 1. `page`: số trang để hiển thị "Trang N", chỉ ghi khi từ 2 trở đi. Cursor các trang trước giữ trong `location.state.prevCursors` (không lên URL).
- Đổi `q`, `category` hoặc `sort` → xoá `cursor` và `page` (về trang 1).
- `GET /api/v1/products?q&category&sort&cursor&limit=20` trả **20 sản phẩm mỗi trang** kèm `nextCursor`; trang dùng `useQuery` (không còn `useInfiniteQuery`) với `placeholderData: keepPreviousData`. **API không trả tổng số kết quả**, nên giao diện không hiện "Tìm thấy N sản phẩm" hay "x / y".
- **Thay đổi API đi kèm** (module `catalog`, chỉ thêm trường): mỗi phần tử `ProductSummary` có thêm `specs` (không bắt buộc, cùng kiểu `Product.specs`) để thẻ hiện dòng tóm tắt thông số (design-system §9.19).
- Cursor trên URL hỏng hoặc hết hạn → API trả 400 → bỏ `cursor` và `page` khỏi URL, tải trang 1.
- Link "Mua theo nhu cầu" ở hàng 2 header (design-system §9.1) so khớp URL **bỏ qua `cursor` và `page`**: đang ở trang 2 của `?category=gpu` vẫn đánh dấu "Chơi game".

## 2. Bố cục (≥1280)

Header 2 hàng và footer như mọi trang. Vùng nội dung giữa header và footer **nền trắng** `--bg-surface` (design-system §1), trong khung `--content-max`, lề `--gutter`.

```
┌ Header hàng 1 (chàm) ───────────────────────────────────────────────────────────┐
├ Header hàng 2: 6 link mua theo nhu cầu ─────────────────────────────────────────┤
Trang chủ › Card đồ hoạ                                                (Breadcrumb)
H1 Card đồ hoạ
┌ Bộ lọc tìm kiếm ┐  ┌ Thanh kết quả ─────────────────────── Sắp xếp [Mới nhất ▾] ┐
│ Loại hàng     ˅ │  │ [thẻ] [thẻ] [thẻ] [thẻ] [thẻ]                                │
│ ○ Tất cả loại   │  │ [thẻ] [thẻ] …                                                │
│ ● Card đồ hoạ   │  │                                                              │
│ …  (dính, cuộn) │  │                  [Trước]  Trang 2  [Sau]                     │
└─────────────────┘  └──────────────────────────────────────────────────────────────┘
┌ Footer (chàm) ──────────────────────────────────────────────────────────────────┐
```

| Phần | Giá trị |
|---|---|
| Vùng nội dung | nền `--bg-surface`, padding dưới 64px; ở trang này footer **không** cách nội dung 32px (nền trắng chạm footer) |
| Breadcrumb | design-system §9.22, padding `16px 0 12px` |
| H1 | 24/32/600 `--fg-default`, cách khối bên dưới 20px; dòng phạm vi (nếu có) 14/20 `--fg-muted`, cách H1 2px |
| Hai cột | `display: grid; grid-template-columns: 296px minmax(0, 1fr); gap: 24px; align-items: start` |
| Cột trái | `FilterPanel` (design-system §9.20), dính ở `top: 148px` |
| Thanh kết quả | `display: flex; align-items: center; justify-content: flex-end; min-height: 56px; padding: 8px 0; margin-bottom: 8px`; **không có đường kẻ dưới**. Bên phải: nhãn "Sắp xếp" 14/20 `--fg-muted`, cách 8px là select cao 40px, rộng tối thiểu 184px (kiểu ô nhập §9.4: nền `--bg-surface-raised`, viền `--border-input`, bo 8px) |
| Lưới | `<ul>` bỏ kiểu danh sách, `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px 16px`; mỗi `<li>` một `ProductListCard` (§9.19) |
| Chuyển trang | `CursorPager` (§9.21), cách lưới 40px |

Số cột thực tế: 1920px → 5 cột (thẻ ~280px); 1366px → 3 cột (thẻ ~295px).

## 3. Các khối

### 3.1 Breadcrumb
| Trường hợp | Đường dẫn |
|---|---|
| Không có gì | Trang chủ › Tất cả sản phẩm |
| Chỉ có `category` | Trang chủ › Card đồ hoạ |
| Có `q` | Trang chủ › Tìm kiếm “rtx” |

"Trang chủ" là link về `/`; mục cuối không phải link (`aria-current="page"`).

### 3.2 Tiêu đề
`<h1>` theo trường hợp:
| Trường hợp | Tiêu đề | Dòng phạm vi |
|---|---|---|
| Có `q` | Kết quả cho “rtx” (ngoặc kép cong) | "Trong mục Card đồ hoạ" nếu có thêm `category` |
| Chỉ có `category` | Tên loại ("Card đồ hoạ") | — |
| Không có gì | Tất cả sản phẩm | — |

Tiêu đề không đổi theo trang. `document.title`: "{tiêu đề} | Black Magic", từ trang 2 thêm " – Trang N".

### 3.3 Cột lọc
`FilterPanel` (design-system §9.20) với một nhóm **"Loại hàng"**: "Tất cả loại" + 13 loại. Loại đang có trên URL được chọn. Chọn loại khác → ghi `category` (giữ `q`, `sort`), xoá `cursor`, `page`. Không có nút "Áp dụng" trên máy tính.

### 3.4 Sắp xếp
Select "Sắp xếp" ở thanh kết quả: **Mới nhất**, **Giá tăng dần**, **Giá giảm dần** (đúng 3 giá trị của BR-08). Đổi → ghi `sort`, xoá `cursor`, `page`.

### 3.5 Lưới sản phẩm
`ProductListCard` (design-system §9.19) cho mỗi sản phẩm, theo thứ tự server trả (hết hàng nằm cuối). Mỗi thẻ có nút "Thêm vào giỏ" (§9.23) thêm 1 sản phẩm, chạy được cả khi khách chưa đăng nhập (giỏ khách, cart BR-01). Hai vùng thông báo cho trình đọc màn hình đặt **một lần ở cấp trang**: `aria-live="polite"` (thêm thành công) và `role="alert"` (lỗi). Không có so sánh, đánh giá, nút lưu trên thẻ.

### 3.6 Chuyển trang
`CursorPager` (design-system §9.21): **Trước · Trang N · Sau**.
- **Sau** (khi còn `nextCursor`): điều hướng (thêm vào lịch sử trình duyệt) tới `cursor = nextCursor`, `page = N + 1`, `state.prevCursors` thêm cursor hiện tại.
- **Trước**: lấy cursor cuối trong `state.prevCursors` (trang 2 về trang 1 thì bỏ `cursor`, `page`). Không có state (mở từ link chia sẻ, tab mới) → về trang 1.
- Nút Back của trình duyệt cũng quay lại trang trước (mỗi trang là một mục lịch sử).
- Sau khi chuyển trang: cuộn lên đầu vùng nội dung và chuyển focus vào `<h1>` (`tabIndex={-1}`), để người dùng bàn phím và trình đọc màn hình bắt đầu lại từ đầu danh sách.
- Chỉ có 1 trang → ẩn dải chuyển trang.

## 4. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Tải lần đầu | trong cột kết quả: dòng "Đang tải sản phẩm…" `--fg-subdued`; cột lọc vẫn hiện |
| Đổi bộ lọc, sắp xếp, trang | giữ kết quả cũ (`keepPreviousData`), lưới opacity .6 và `aria-busy="true"` tới khi có kết quả mới |
| Lỗi | trong cột kết quả: "Chưa tải được sản phẩm. Tải lại trang để thử lần nữa." `role="alert"` |
| Cursor hỏng (400) | tự về trang 1, không báo lỗi |
| Không có kết quả tìm kiếm | `EmptyState` trong cột kết quả: "Không có sản phẩm nào có “{q}” trong tên." + link "Xem tất cả sản phẩm"; ẩn thanh kết quả và dải chuyển trang |
| Loại hàng chưa có sản phẩm | `EmptyState`: "Mục này chưa có sản phẩm." + link "Xem tất cả sản phẩm" |
| Sản phẩm hết hàng | vẫn hiện, nằm cuối, `StockBadge` "Hết hàng", ô ảnh mờ .6, nút "Hết hàng" vô hiệu |
| Thêm vào giỏ | trạng thái trên nút theo design-system §9.23 |

`EmptyState`: design-system §9.12 (nền `--bg-surface`, viền `--border-divider`, bo 16px, padding `40px 16px`, căn giữa).

Lưu ý dữ liệu có thể trễ tới 60 giây (cache CloudFront): tên vừa đổi có thể chưa tìm thấy, "còn hàng" có thể vừa hết. Giao diện không cần báo; thêm giỏ và đặt hàng server kiểm lại.

## 5. Điện thoại và máy tính bảng (<1280)

- Một cột, **không có** `FilterPanel` bên trái. Breadcrumb padding `12px 0 8px`; H1 theo design-system §3 (<640: 20/28), cách thanh kết quả 12px.
- Thanh kết quả là một hàng: **3 chip sắp xếp** (Mới nhất, Giá tăng dần, Giá giảm dần; chọn là áp dụng ngay) bên trái, gap 6px, cuộn ngang nếu thiếu chỗ (ẩn thanh cuộn); nút **"Lọc"** sát phải mở `FilterSheet` (design-system §9.20). Không có select "Sắp xếp".
- Lưới: <768: **2 cột**, `gap: 20px 12px`; 768–1279: `repeat(auto-fill, minmax(200px, 1fr))`, `gap: 24px 16px`.
- Thẻ: tên 13/18, giá 20/28, nút chữ 13px (§9.19).
- `CursorPager` cách lưới 28px.

| Màn | Khác biệt |
|---|---|
| 390px | Hàng chip + "Lọc" vừa một hàng; lưới 2 cột (thẻ ~175px); bảng lọc phủ toàn màn hình |
| 1366px | Bố cục máy tính (§2), lưới 3 cột |
| 1920px | Như 1366px, lưới 5 cột |

## 6. Trợ năng
- Một `<h1>` hiển thị; nhận focus sau khi chuyển trang.
- Cột lọc: `<aside aria-label="Bộ lọc">`, nhóm là `<fieldset>` + `<legend>` (ẩn), đầu nhóm `aria-expanded`; radio gốc của trình duyệt (phím mũi tên đổi lựa chọn).
- Select "Sắp xếp" có nhãn bằng `<label>` bọc ngoài; chip sắp xếp là `<button aria-pressed>` trong `role="group" aria-label="Sắp xếp"`.
- Nút "Lọc": `aria-haspopup="dialog"`, `aria-expanded`; bảng lọc giữ focus, Esc đóng, trả focus về nút.
- Lưới là `<ul>`; `aria-busy` khi đang tải lại.
- Nút thêm vào giỏ: `aria-label` có tên sản phẩm; kết quả đọc qua hai vùng thông báo ở cấp trang (§3.5).
- Chuyển trang: `<nav aria-label="Phân trang">`, "Trang N" có `aria-current="page"`, nút vô hiệu có `aria-disabled`.
- Lỗi dùng `role="alert"`.

## 7. Không làm trong bản chốt
Lọc theo hãng, giá, thông số, "chỉ hiện hàng còn"; chip bộ lọc đang chọn; "Tìm thấy N sản phẩm"; số trang 1 2 3; so sánh, đánh giá, lưu, ảnh nhỏ, nhãn quảng cáo, "Xem thêm" (xem [ngoai-pham-vi.md](../ngoai-pham-vi.md)).

## 8. Thiết kế 3 (dự kiến Sprint 2, chưa chốt nghiệp vụ)
Bố cục, thẻ, chuyển trang giữ nguyên; chỉ thêm:
- **Nhiều nhóm lọc** trong `FilterPanel`, đổi theo loại hàng: "Khoảng giá" (radio các khoảng + hai ô nhập "Từ … Đến" cao 36px, đuôi ".000₫"), "Hãng" (checkbox), các nhóm thông số theo loại (vd. Laptop: Dòng CPU, Card đồ hoạ, RAM, SSD, Kích thước màn hình; Card đồ hoạ: VRAM, Nguồn đề xuất; Màn hình: Kích thước, Độ phân giải, Tần số quét, Tấm nền), "Tình trạng: Chỉ hiện hàng còn". Mỗi nhóm checkbox mở đầu bằng "Tất cả", hiện 6 lựa chọn rồi link "Xem thêm" 12/18/600 `--fg-primary`. Nhóm chỉ có 1 giá trị thì ẩn. Đầu cột có "Bỏ chọn" khi đang lọc.
- **Chip bộ lọc đang chọn** dưới thanh kết quả (cao 32px, bo tròn, nút × từng chip, "Xoá tất cả").
- **"Tìm thấy N sản phẩm"** ở bên trái thanh kết quả (14/20 `--fg-muted`, số 700 `--fg-default`).
- Cần trước: sửa catalog BR-02 (lọc nhiều nhóm) và OpenAPI `GET /api/v1/products` (tham số lọc, `total`, `facets`), An đồng ý cách tìm trong bộ nhớ Lambda. Bản mẫu HTML có nút "Thiết kế 3" (trên máy Hoàng, thư mục bản nháp không vào git).

## 9. Việc còn lại
- Tách `EmptyState` thành component dùng chung (giỏ hàng rỗng, chưa có đơn hàng dùng lại).
- Trang chi tiết dùng `Breadcrumb` (§9.22) khi làm lại.
- Thêm vùng `aria-live` đọc "Đã hiện trang N" sau khi chuyển trang (tuỳ chọn, ngoài việc chuyển focus vào H1).
