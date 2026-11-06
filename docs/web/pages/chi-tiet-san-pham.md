# Chi tiết sản phẩm `/products/:productId`

Bản chốt 03/11/2026 (thay bản 08/10). Code: `features/catalog/pages/ProductDetailPage.tsx`, `features/cart/components/AddToCart.tsx`, `features/catalog/components/SpecTiles.tsx`, `SpecPanel.tsx`. Nghiệp vụ: `docs/business/catalog.md` (BR-04, BR-06, BR-07), `docs/business/cart.md` (BR-01, BR-03, BR-04). Đọc kèm [design-system.md](../design-system.md) (§9.1 header, §9.24 ô thông số và panel thông số).

Bố cục: nền xám, các khối trắng bo 16px. Cột trái có khối sản phẩm (ảnh, bên cạnh là tên và mô tả) rồi khối thông số riêng bên dưới; hộp mua 360px ở cột phải, không dính. Thông số là các ô; bấm một ô thì panel mở từ bên phải và cuộn tới đúng thông số đó. Ở máy tính, hàng 2 của header thu lại khi cuộn xuống. Những gì trang này **không làm**: xem mục 7.

## 1. Đường dẫn và dữ liệu

- `GET /api/v1/products/{productId}` trả `Product`: `productId`, `name`, `brand`, `category`, `price`, `stock`, `status`, `imageUrl?` (**một ảnh**), `description`, `specs?` (object khoá → giá trị, tuỳ loại hàng), `createdAt`, `updatedAt`. **API không đổi** cho trang này.
- `INACTIVE` hoặc không có sản phẩm → API trả 404 (catalog BR-04), nên trang không có trạng thái "Ngừng bán". `productId` sai dạng (ký tự ngoài chữ, số, dấu gạch ngang) → API trả 400. Trang hiện cả hai như "không tìm thấy" (§4).
- Thêm vào giỏ qua `useCart().add` (cart BR-01): đã đăng nhập thì `POST /api/v1/cart/items`; chưa đăng nhập thì vào giỏ khách trên trình duyệt, **không** chuyển sang `/login`. Số lượng 1 … min(99, `stock`) (cart BR-03); giỏ đã có món này thì server có thể trả `QUANTITY_LIMIT` kèm `maxAddable`.
- Lượt xem cho gợi ý: đã đăng nhập và tải được sản phẩm thì gửi `POST /api/v1/events` `VIEW` một lần cho mỗi sản phẩm (`useRecordView`, events.md mục 1); khách vãng lai, 404 hay lỗi thì không gửi; gửi lỗi thì bỏ qua, không ảnh hưởng trang.
- Widget "Thường mua kèm" ở cuối trang: `AlsoBought` có sẵn (`GET /api/v1/recs/also-bought`, ADR-0016, An làm), không đổi.

**Ghép dữ liệu thông số với giao diện** (phần web tự lo, không cần đổi API):

| Dữ liệu | Cách hiện |
|---|---|
| Khoá `specs` là mã tiếng Việt không dấu (`cpu`, `nguon_de_xuat`…) | Nhãn có dấu lấy từ `specLabels.ts` (đã đủ 49 khoá của bộ dữ liệu demo); khoá chưa có nhãn thì hiện nguyên mã |
| Giá trị kiểu `unknown` | Như hàm `specValue` hiện có: chuỗi (bỏ khoảng trắng hai đầu) và số in nguyên; `true`/`false` → "Có"/"Không"; mảng nối ", "; object lồng và chuỗi rỗng thì bỏ dòng đó |
| Thứ tự khoá | **Không dựa vào thứ tự khoá API trả về**: bảng lưu `specs` dạng Map của DynamoDB, thứ tự khoá không được đảm bảo giống file seed. Web xếp theo bảng thứ tự từng loại hàng (`SPEC_ORDER`, design-system §9.24); khoá không có trong bảng xếp sau, theo thứ tự trả về |
| Cùng một khoá, nghĩa khác theo loại hàng | `kich_thuoc` là chiều dài card (gpu), cỡ màn hình (monitor), chuẩn bo mạch (mainboard); `ram` ở mainboard là loại RAM hỗ trợ; `socket` ở tản nhiệt là danh sách socket ghi trên hộp. Nhãn ô giữ một nhãn chung; **câu giải thích trong panel tra theo `loại.khoá` trước, rồi tới `khoá`** (`specHelp.ts`) |
| Số thông số mỗi sản phẩm | Bộ dữ liệu demo có 2–5 (13 sản phẩm có 2, 48 có 3, 32 có 4, 11 có 5); admin sau này có thể nhập nhiều hơn. Cách chia ô theo hàng ở §3.5 chạy với số bất kỳ |
| Giá trị dài | Dài nhất trong dữ liệu demo 42 ký tự ("HDMI 4K, LAN, 2x USB-A, USB-C, SD, PD 100W"): ô cắt 1 dòng với `…` và có `title`; panel hiện đầy đủ |
| `specs` thiếu hoặc không còn dòng nào sau khi lọc | Không render khối thông số (không có khối rỗng) |
| `description` | Bộ dữ liệu demo dài tối đa 66 ký tự; vẫn giữ `white-space: pre-line` cho mô tả nhiều dòng do admin nhập sau này |
| `imageUrl` | Bộ dữ liệu demo **không có ảnh** → hiện icon loại hàng; có ảnh thì hiện ảnh |

## 2. Bố cục

```
[Header hàng 1, dính] [Header hàng 2, thu lại khi cuộn, chỉ ≥1280]
Trang chủ › Laptop › Laptop ASUS TUF Gaming A15…                   (breadcrumb)
┌ Khối sản phẩm ──────────────────────────────────┐ ┌ Hộp mua 360px ──┐
│ ┌ Ảnh (≤560) ─┐  [icon] Laptop                  │ │ 24.990.000₫     │
│ │             │  H1 tên sản phẩm                │ │ [Còn hàng]      │
│ │   vuông     │  Hãng ASUS                      │ │ ┌ Giao hàng ──┐ │
│ │             │  ─────────────                  │ │ │ Miễn phí,COD│ │
│ │             │  Mô tả                          │ │ └─────────────┘ │
│ └─────────────┘  Laptop gaming 15.6 inch…       │ │ Số lượng [-1+] │
└─────────────────────────────────────────────────┘ │ [Thêm vào giỏ]  │
┌ Thông số kỹ thuật ──────────────────────────────┐ │ (kết quả)       │
│ [CPU ›] [GPU ›] [RAM ›] [SSD ›] [Màn hình ›]    │ └─────────────────┘
└─────────────────────────────────────────────────┘
Thường mua kèm (widget có sẵn), toàn bề ngang
```

| Phần | Giá trị |
|---|---|
| Nền trang | `--bg-canvas` (route mặc định, không dùng `surface: 'plain'`) |
| Khung | trong `--content-max`, lề `--gutter` |
| Header → breadcrumb | breadcrumb sát dưới header như trang danh sách: padding của `Breadcrumb` (§9.22: `16px 0 12px`, <1280: `12px 0 8px`) là toàn bộ khoảng cách, không cộng thêm padding trên của `main` |
| Lưới chính (≥960) | `display: grid; grid-template-columns: minmax(0,1fr) var(--pdp-aside); grid-template-rows: auto 1fr; grid-template-areas: "prod buy" "spec buy"; gap: 24px; align-items: start` |
| Lưới chính (<960) | một cột, `grid-template-areas: "prod" "buy" "spec"`, gap 16px (<640: 8px) |
| Khối (mọi khối) | nền `--bg-surface`, bo `--radius-2xl` (16px), padding 24px, **không viền, không bóng**, `min-width: 0` |
| Trong khối sản phẩm (≥1280) | `grid-template-columns: minmax(0, var(--pdp-media-max)) minmax(320px, 1fr); gap: 32px; align-items: start` |
| Trong khối sản phẩm (<1280) | một cột: ảnh trên (rộng tối đa `--pdp-media-max`), thông tin dưới, gap 24px |
| Widget gợi ý | ngoài lưới, toàn bề ngang, như `StoryBlock` ở trang chủ (padding trên 32px); footer cách 32px như mặc định |

Hộp mua **không dính** (`position: static`), như trang tham khảo phụ.

## 3. Các khối

### 3.1 Breadcrumb
Dùng `Breadcrumb` có sẵn (design-system §9.22): "Trang chủ" (`/`) › tên loại hàng (`/products?category=…`) › tên sản phẩm (mục cuối, `aria-current="page"`, cắt 1 dòng với `…`). Tên loại lấy từ nhãn loại hàng trong `productFilters.ts` (export thêm một hàm lấy nhãn, vd. `categoryLabel(category)`).

Dưới 640px chỉ hiện một link "‹ {tên loại}" (icon `ChevronLeft` 16, chữ 14/20/500 `--fg-primary`, gap 2px) về danh sách loại đó, vẫn nằm trong `<nav aria-label="Đường dẫn">`. Bỏ nút "← Quay lại" hiện có.

### 3.2 Ảnh sản phẩm
- Ô vuông (`aspect-ratio: 1`), nền `--bg-subtle`, bo `--radius-lg` (8px), padding 24px, rộng tối đa `--pdp-media-max` (560px).
- Có ảnh: `<img>` `object-fit: contain`, `mix-blend-mode: multiply`, `alt` = tên sản phẩm (ảnh lớn đứng riêng). Đây là phần tử lớn nhất đầu trang nên **không** `loading="lazy"`; thêm `fetchpriority="high"` và `width`/`height` để không giật bố cục.
- Không có ảnh (toàn bộ dữ liệu demo): icon loại hàng (`CategoryIcon`) 56px màu `--fg-icon-soft` giữa ô, không ghi chữ "Không có ảnh".
- Hết hàng: ô ảnh `opacity: .6`.
- Không có dải ảnh nhỏ, không phóng to (chỉ có một ảnh).

### 3.3 Thông tin (bên cạnh ảnh)
Cột flex dọc, gap 8px, `min-width: 0`:

| Dòng | Kiểu |
|---|---|
| Loại hàng | `CategoryIcon` 16px + tên loại, gap 6px, 14/20/500, link `--fg-primary` tới `/products?category=…`, gạch chân khi rê chuột |
| Tên `<h1>` | 24/32/600 `--fg-heading`, `text-wrap: balance`, không cắt dòng (<640: 20/28) |
| Hãng | 14/20 `--fg-subdued`: "Hãng ASUS" |
| Vạch ngăn | `<hr>` 1px `--border-divider`, cách trên 16px, dưới 8px |
| Tiêu đề "Mô tả" | `<h2>` 16/24/600 `--fg-heading`, cách trên 8px, dưới 4px |
| Mô tả | `description`, 16/24 `--fg-muted`, `white-space: pre-line`, rộng tối đa 72 ký tự |

Không hiện `productId`, không lặp lại thông số ở đây.

### 3.4 Hộp mua
`<aside aria-label="Mua hàng">`, một khối (§2), cột flex gap 16px:
1. **Giá + tồn kho** (cột, gap 6px): `Price size="lg"` (32/44/700) rồi `StockBadge` (Còn hàng / Chỉ còn N / Hết hàng). Không có giá cũ, "tiết kiệm", trả góp.
2. **Giao hàng**: ô viền 1px `--border-default`, bo 8px, padding `12px 16px`, gap 4px. Dòng 1: icon `Truck` 20 `--fg-primary` + "Giao hàng miễn phí" 14/20/600 `--fg-heading`. Dòng 2: icon `Banknote` 20 `--fg-icon-soft` + "Thanh toán khi nhận hàng (COD)" 12/18 `--fg-subdued` (ordering BR-05, BR-06). Không có lựa chọn nhận tại cửa hàng.
3. **Số lượng**: nhãn "Số lượng" 14/20/500 `--fg-heading` bên trái, `QuantityStepper` (§9.6) bên phải, cùng hàng (`justify-content: space-between`). Giới hạn 1 … min(99, `stock`).
4. **Nút** chính cỡ `lg` (§9.3), `width: 100%`, icon `ShoppingCart` 20 + "Thêm vào giỏ". Đang gửi: "Đang thêm…" (`aria-busy`, chặn bấm, giữ bề rộng).
5. **Kết quả** ngay dưới nút: thành công `Alert success` "Đã thêm vào giỏ." + link "Xem giỏ hàng", số lượng về 1; lỗi `Alert` theo `addErrorMessage` (`QUANTITY_LIMIT` warning; `PRODUCT_UNAVAILABLE`, `CART_FULL`, lỗi mạng danger; 401 kèm link "Đăng nhập" quay lại trang này).

### 3.5 Thông số kỹ thuật (khối riêng)
`<section aria-labelledby>` là một khối riêng nằm **dưới** khối sản phẩm ở cột trái, không chung khối với ảnh. Tiêu đề `<h2>` "Thông số kỹ thuật" 20/28/600 `--fg-heading`, cách các ô 16px (<640: 18/26, cách 12px). Bên dưới là `SpecTiles` (design-system §9.24):
- `<ul>` lưới ô, gap 8px; mỗi ô là một `<button>` mở panel.
- **Chia ô theo hàng cho đều:** từ bề rộng của danh sách tính số cột tối đa sao cho mỗi ô rộng ít nhất `--spec-tile-min` (220px; <640: 150px), rồi cân lại để các hàng gần bằng nhau: `cols = min(n, maxCols)`, `rows = ceil(n / cols)`, `cols = ceil(n / rows)`. Hàng trên luôn đầy rồi mới xuống hàng; mọi ô cùng bề rộng, ô ở hàng cuối không kéo giãn.
- Kết quả trên dữ liệu demo: 1920px: 5 thông số → 1 hàng 5 ô (~266px), 4 → 1 hàng 4 ô; 1366px: 5 → 3 + 2, 4 → 2 + 2; 390px: 2 cột (5 → 2 + 2 + 1).
- Thứ tự ô theo `SPEC_ORDER` của loại hàng (§1).

### 3.6 Panel thông số
Bấm một ô: `SpecPanel` (design-system §9.24) trượt ra từ bên phải, phủ vùng tối lên trang, **cuộn tới đúng thông số vừa bấm** và đánh dấu mục đó ở cột mục lục. Panel có tất cả thông số của sản phẩm, mỗi thông số một phần:
- Tiêu đề `<h3>` = nhãn thông số.
- Ô giá trị: giá trị đầy đủ + nhãn "Sản phẩm này" (`Badge primary`).
- Một câu giải thích **thông số đó là gì**, tra trong `specHelp.ts` theo `loại.khoá` rồi `khoá`; không có thì hiện "Chưa có phần giải thích cho thông số này." màu `--fg-subdued`. Câu giải thích không khuyên chọn, không nói linh kiện nào lắp được với nhau (catalog BR-06).
- Không có bậc so sánh (cao cấp, phổ thông…) vì dữ liệu không có.

Đóng bằng nút X, Esc hoặc bấm vùng tối; đóng xong focus về đúng ô đã bấm.

### 3.7 Thường mua kèm
`AlsoBought` có sẵn (`StoryBlock` + `Carousel` + `ProductCard`), không đổi. Không có gợi ý thì không render.

### 3.8 Header trên trang này
Header giữ như design-system §9.1, riêng trang chi tiết ở **≥1280px**: khi trang ở trên cùng thì hiện đủ 2 hàng; cuộn xuống thì hàng 2 (6 link mua theo nhu cầu) **ẩn đi trong 200ms** (`--dur-base`), hàng 1 vẫn dính trên cùng và có thêm `--shadow-sm` ở mép dưới; cuộn lên đầu trang thì hàng 2 hiện lại. Dưới 1280px header không đổi (vốn không có hàng 2). Cách làm để nội dung không bị xô: design-system §9.1 "Hàng 2 thu lại khi cuộn".

## 4. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | khung chờ đúng bố cục: thanh breadcrumb 280×20; khối sản phẩm có ô ảnh vuông + 4 thanh chữ (30%×20, 90%×32, 60%×32, 25%×20); hộp mua cao 320px; gradient chờ như §9.12, `aria-busy="true"` trên lưới |
| 404 | breadcrumb chỉ có "Trang chủ"; một khối `EmptyState` căn giữa (padding `56px 24px`, <640: `40px 16px`): icon `Search` 48 `--fg-icon-soft`, "Sản phẩm không tồn tại hoặc đã bị gỡ." 16/24 `--fg-muted`, nút phụ `md` "Xem tất cả sản phẩm" → `/products`. Hiện ngay, không chờ thử lại |
| Lỗi tải | "Chưa tải được sản phẩm. Tải lại trang để thử lần nữa." `role="alert"` (§9.12) |
| Hết hàng (`stock = 0`) | ô ảnh opacity .6; badge "Hết hàng"; **ẩn** bộ chọn số lượng; nút vô hiệu "Hết hàng" (nền `--bg-surface-raised`, viền `--border-divider`, chữ `--fg-disabled`, không icon); ô thông số và panel vẫn dùng được |
| Tồn kho thấp (`stock ≤ 5`) | badge "Chỉ còn N"; nút + của bộ chọn vô hiệu khi đạt N |
| Chưa đăng nhập | như khi đã đăng nhập; món vào giỏ khách. Phiên hết hạn (401) → `Alert danger` "Phiên đăng nhập đã hết…" + link Đăng nhập |
| Không có `specs` | không có khối thông số; cột trái chỉ còn khối sản phẩm |
| Panel đang mở | trang nền khoá cuộn; header nằm dưới vùng tối |

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| ≥1280 | Như sơ đồ §2; header 2 hàng, hàng 2 thu lại khi cuộn; panel rộng 50% màn (tối thiểu 560px), mục lục bên trái |
| 960–1279 | Hai cột (cột trái + hộp mua 360px); trong khối sản phẩm ảnh nằm trên thông tin; header bản điện thoại |
| 640–959 | Một cột: Khối sản phẩm → Hộp mua → Thông số → gợi ý; gap 16px |
| <640 (390px) | Khối **tràn hết bề ngang, không bo góc**, padding `24px 16px`, cách nhau 8px (nền xám lộ ra thành vạch ngăn); breadcrumb rút gọn "‹ {loại}" vẫn có lề 16px; H1 20/28; ô thông số 2 cột, padding `10px 12px`, gap trong ô 8px, **ẩn mũi tên ›**; panel rộng `calc(100vw - 32px)` (chừa 32px vùng tối bên trái), mục lục thành **hàng tab cuộn ngang** dưới đầu panel |

## 6. Trợ năng
- Một `<h1>` (tên sản phẩm). "Mô tả" và "Thông số kỹ thuật" là `<h2>`; tiêu đề từng thông số trong panel là `<h3>`.
- Breadcrumb `<nav aria-label="Đường dẫn">` + `<ol>`, mục cuối `aria-current="page"`.
- Ô thông số là `<button type="button" aria-haspopup="dialog">`; tên đọc được gồm nhãn và giá trị ("CPU Ryzen 7 7735HS"); mũi tên `aria-hidden`.
- Panel: `role="dialog" aria-modal="true" aria-labelledby` (tiêu đề "Thông số kỹ thuật"); mở xong focus vào nút đóng (`aria-label="Đóng"`); giữ focus trong panel (`trapTabKey`); Esc đóng; đóng xong focus về ô đã bấm. Cột mục lục là `<nav aria-label="Các thông số">`, mục đang xem có `aria-current="true"`.
- Hàng 2 header khi đã ẩn: `inert` (Tab không vào link đã ẩn).
- Nút tăng/giảm có nhãn "Tăng số lượng {tên}"; kết quả thêm giỏ: thành công `role="status"`, lỗi `role="alert"`.
- `prefers-reduced-motion: reduce`: panel, vùng tối và hàng 2 header đổi trạng thái ngay, không trượt.

## 7. Ngoài phạm vi
Dải ảnh nhỏ, video, phóng to ảnh; mã model và SKU; nhãn "Bán chạy"; sao, số đánh giá, tóm tắt đánh giá, hỏi đáp, ảnh của khách; giá cũ, mức tiết kiệm, nhãn khuyến mãi, trả góp, nút báo giảm giá; thu cũ đổi mới; chọn nhận tại cửa hàng; gói bảo hành; phụ kiện kèm, so sánh sản phẩm; bậc so sánh thông số (cao cấp, phổ thông…) và lời khuyên chọn linh kiện trong panel; nhãn hay kiểm tra tương thích (catalog BR-06); biến thể (BR-07); banner quảng cáo, trợ lý chat. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md).

## 8. Việc còn lại
- `Button` và `EmptyState` vẫn chưa tách thành component (design-system §9); làm trang này thì có thể tách, hoặc viết class trong `ProductDetailPage.module.css` theo đúng số đo ở §9.3 và §9.12.
- Khi có trang admin nhập sản phẩm: khoá `specs` mới cần thêm nhãn vào `specLabels.ts`, thứ tự vào `SPEC_ORDER` và câu giải thích vào `specHelp.ts`. Thiếu thì trang vẫn chạy: nhãn là mã, ô xếp cuối, panel ghi "Chưa có phần giải thích".
