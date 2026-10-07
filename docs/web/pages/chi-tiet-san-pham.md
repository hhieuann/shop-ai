# Chi tiết sản phẩm `/products/:productId`

Code: `features/catalog/pages/ProductDetailPage.tsx`, `features/cart/components/AddToCart.tsx`. Nghiệp vụ: `docs/business/catalog.md`, `docs/business/cart.md` (BR-01, BR-03, BR-04). Đọc kèm [design-system.md](../design-system.md).

Bố cục: khối ảnh + thông tin bên trái, hộp mua hàng bên phải, thông số dạng bảng sọc bên dưới. Những gì trang này **không làm**: xem mục 7.

## 1. Đường dẫn và dữ liệu

- `GET /api/v1/products/{productId}` trả `Product`: `name`, `brand`, `category`, `price`, `stock`, `status`, `imageUrl?` (**một ảnh**), `description`, `specs?` (object khoá → giá trị, tuỳ loại hàng), `createdAt`, `updatedAt`.
- Không có nhiều ảnh, không có biến thể, không có đánh giá → không có dải ảnh nhỏ, không có ô chọn màu/cấu hình, không có sao.
- Thêm vào giỏ qua `useCart().add` (cart BR-01): đã đăng nhập thì `POST /api/v1/cart/items`; chưa đăng nhập thì thêm vào giỏ khách trên trình duyệt, **không** chuyển sang `/login`.
- `INACTIVE` → API trả 404 (catalog BR-04), nên trang không có trạng thái "Ngừng bán".
- Widget "Thường mua kèm" ở cuối trang (ADR-0016, An làm): `GET /api/v1/recs`, đã lọc hàng hết và hàng đã có trong giỏ.

## 2. Bố cục

```
Trang chủ › Card đồ hoạ › ASUS Dual RTX 4060…            (breadcrumb)
┌ Khối sản phẩm ─────────────────────────────┐ ┌ Hộp mua (360px) ─┐
│ ┌ Ảnh ─────────┐  [icon] Card đồ hoạ        │ │ 8.490.000₫       │
│ │              │  H1 tên sản phẩm          │ │ [Còn hàng]       │
│ │  vuông       │  Hãng ASUS                │ │ ┌ Giao hàng ───┐ │
│ │              │                           │ │ │ Miễn phí, COD│ │
│ └──────────────┘                           │ │ └──────────────┘ │
└────────────────────────────────────────────┘ │ Số lượng [-1+]  │
┌ Thông tin sản phẩm ────────────────────────┐ │ [ Thêm vào giỏ ] │
│ Mô tả              │ Thông số kỹ thuật      │ └──────────────────┘
└────────────────────────────────────────────┘
┌ Thường mua kèm (widget của An) — toàn bề ngang ───────────────┐
```

| Phần | Giá trị |
|---|---|
| Khung | trong `--content-max`, lề `--gutter` |
| Breadcrumb | cách trên 8px, cách nội dung 16px |
| Lưới chính (≥960) | `display:grid; grid-template-columns: minmax(0,1fr) 360px; gap:24px; align-items:start`. Cột trái gồm Khối sản phẩm và Thông tin sản phẩm xếp dọc, cách nhau 24px. Hộp mua ở cột phải, `grid-row: 1 / span 2` |
| Khối (mọi khối) | nền `--bg-surface`, viền 1px `--border-divider`, bo 16px, padding 24px (<640: 16px) |
| Trong Khối sản phẩm (≥1280) | `grid-template-columns: minmax(0,560px) minmax(320px,1fr); gap:32px`. Dưới 1280: ảnh trên, thông tin dưới, cách 24px |
| Widget gợi ý | cách 32px, toàn bề ngang (ngoài lưới) |

Hộp mua **không dính** (`sticky`) vì header đã dính và cao; xem lại khi đo thực tế.

## 3. Các khối

### 3.1 Breadcrumb
`<nav aria-label="Đường dẫn">` chứa `<ol>`, chữ 14/20, các mục cách nhau bằng icon `ChevronRight` 16px màu `--fg-subdued` (`aria-hidden`), gap 4px.
- "Trang chủ" (`/`) › tên loại hàng (`/products?category=…`) là link `--fg-primary`; mục cuối là tên sản phẩm, màu `--fg-subdued`, `aria-current="page"`, cắt 1 dòng với `…`.
- Dưới 640px chỉ hiện một link "‹ {tên loại}" (icon `ChevronLeft`) để quay lại danh sách loại đó.
- Thay cho nút "← Quay lại" hiện có.

### 3.2 Ảnh sản phẩm
- Ô vuông, `--bg-image-plate`, bo 8px, padding 24px, rộng tối đa 560px; ảnh `contain` + `multiply`, `alt` = tên sản phẩm (ảnh lớn đứng một mình nên cần alt).
- Không có ảnh: icon loại hàng 56px màu `--border-input` (`#8C82A0`) giữa ô (design-system §8), không ghi chữ "Không có ảnh".
- Không có dải ảnh nhỏ, không phóng to khi rê chuột (chỉ có một ảnh).

### 3.3 Thông tin
Xếp dọc, gap 8px:
| Dòng | Kiểu |
|---|---|
| Loại hàng | `CategoryIcon` 16px + tên loại, 14/20/500, link `--fg-primary` tới `/products?category=…` |
| Tên `<h1>` | 24/32/600 (`--text-title-md`), không cắt dòng |
| Hãng | 14/20 `--fg-subdued`: "Hãng ASUS" |

Không hiện `productId` (ULID, không có nghĩa với khách) và không lặp lại thông số ở đây; thông số chỉ nằm trong bảng ở 3.5.

### 3.4 Hộp mua
Một khối (§2), gap 16px giữa các phần:
1. **Giá** `Price lg` (32/44). Không có giá cũ, "tiết kiệm", trả góp.
2. **Tồn kho** `StockBadge` (Còn hàng / Chỉ còn N / Hết hàng). Thay dòng chữ "Còn hàng (12)" hiện có.
3. **Giao hàng**: ô nền `--bg-surface-raised`, bo 8px, padding `12px 16px`, gap 4px. Dòng 1: icon `Truck` 20px + "Giao hàng miễn phí" 14/20/500. Dòng 2: "Thanh toán khi nhận hàng (COD)" 12/18 `--fg-subdued` (ordering BR-05, BR-06). Không có lựa chọn nhận tại cửa hàng.
4. **Số lượng**: nhãn "Số lượng" 14/20/500 bên trái, `QuantityStepper` bên phải, cùng hàng (`justify-content:space-between`). Giới hạn 1 … min(99, tồn kho).
5. **Nút** `Button primary lg`, `width:100%`, icon `ShoppingCart` 20 + "Thêm vào giỏ". Đang gửi: "Đang thêm…" (`aria-busy`).
6. **Kết quả** ngay dưới nút: thành công `Alert success` "Đã thêm vào giỏ." + link "Xem giỏ hàng"; lỗi `Alert` theo mã (`QUANTITY_LIMIT` warning, `PRODUCT_UNAVAILABLE` / `CART_FULL` / lỗi mạng danger), câu chữ giữ như `addErrorMessage` trong code.

### 3.5 Thông tin sản phẩm
`<section aria-labelledby>`. Tiêu đề khối `<h2>` 20/28/600 "Thông tin sản phẩm". Bên trong hai phần (≥1280 nằm cạnh nhau `1fr 1fr` gap 32px; nhỏ hơn thì xếp dọc gap 24px), mỗi phần có `<h3>` 16/24/600 cách nội dung 12px:
- **Mô tả**: `description`, 16/24 `--fg-muted`, `white-space: pre-line` (giữ xuống dòng của admin), rộng tối đa 72 ký tự mỗi dòng.
- **Thông số kỹ thuật**: `<table>` rộng 100%, mỗi cặp một `<tr>`: `<th scope="row">` 14/20/500 `--fg-subdued` rộng 40%, `<td>` 14/20 `--fg-default`. Ô padding `12px 16px`; **hàng lẻ** nền `--bg-surface-raised` bo 4px (bo ở ô đầu và ô cuối của hàng). Giá trị: chuỗi/số in nguyên; `true`/`false` → "Có"/"Không"; mảng nối bằng ", "; object lồng thì bỏ qua. Không có `specs` → bỏ phần này, Mô tả chiếm cả khối.

### 3.6 Thường mua kèm (widget của An)
`StoryBlock` tiêu đề "Thường mua kèm" + `Carousel` + `ProductCard`, như dải sản phẩm ở trang chủ (giao-dien.md §6). Không có gợi ý → không render khối (không hiện khối rỗng).

## 4. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | khung chờ: ô ảnh vuông + 3 thanh chữ + hộp mua cao 320px, gradient chờ như §9.12, `aria-busy` |
| 404 | `EmptyState`: "Sản phẩm không tồn tại hoặc đã bị gỡ." + link "Xem tất cả sản phẩm" |
| Lỗi tải | "Chưa tải được sản phẩm. Tải lại trang để thử lần nữa." `role="alert"` |
| Hết hàng (`stock = 0`) | ô ảnh opacity .6; badge "Hết hàng"; ẩn bộ chọn số lượng; nút `secondary` vô hiệu "Hết hàng" |
| Chưa đăng nhập | giao diện và thông báo như khi đã đăng nhập; món vào giỏ khách. Phiên đăng nhập hết hạn (401) → `Alert danger` "Phiên đăng nhập đã hết…" kèm link Đăng nhập |
| Tồn kho thấp | badge "Chỉ còn N"; nút + của bộ chọn vô hiệu khi đạt N |

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| 390px | Một cột: breadcrumb rút gọn → Khối sản phẩm (ảnh trên, thông tin dưới) → Hộp mua → Thông tin sản phẩm → gợi ý. Khối padding 16px. H1 20/28 |
| 960–1279 | Hai cột (khối trái + hộp mua 360px); ảnh nằm trên thông tin trong khối trái |
| ≥1280 | Như sơ đồ mục 2 |

## 6. Trợ năng
- Một `<h1>` (tên sản phẩm). Khối Thông tin sản phẩm dùng `<h2>`, các phần trong dùng `<h3>`.
- Breadcrumb là `<nav aria-label="Đường dẫn">` + `<ol>`, mục cuối `aria-current="page"`.
- Nút tăng/giảm có nhãn "Tăng số lượng {tên}"; ô số có `<label>` "Số lượng".
- Kết quả thêm giỏ: thành công `role="status"`, lỗi `role="alert"`.
- Bảng thông số có `<caption class="sr-only">Thông số kỹ thuật</caption>`.

## 7. Ngoài phạm vi
Dải ảnh nhỏ, video, phóng to ảnh; mã model và SKU; khối tóm tắt thông số lặp lại cạnh ảnh; nhãn "Bán chạy"; sao, số đánh giá, tóm tắt đánh giá, hỏi đáp, ảnh của khách; giá cũ, mức tiết kiệm, nhãn khuyến mãi, trả góp, nút báo giảm giá; thu cũ đổi mới; chọn nhận tại cửa hàng; gói bảo hành; phụ kiện kèm, so sánh sản phẩm, "thường mua cùng" (phần gợi ý do widget của An đảm nhận); banner quảng cáo, trợ lý chat. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md).

## 8. Việc còn lại
- Khoá `specs` trong bộ dữ liệu demo (`services/api/seed/catalog/products.json`, #44) là **mã tiếng Việt không dấu** (`cpu`, `ram`, `socket`, `vram`, `nguon_de_xuat`, `ket_noi`, `kich_thuoc`, `dung_luong`, `man_hinh`, `do_phan_giai`, `tam_nen`, `tan_so`…). Cần bảng nhãn có dấu (vd. `nguon_de_xuat` → "Nguồn đề xuất") trong `features/catalog/lib/specLabels.ts`; khoá chưa có nhãn thì hiện nguyên mã.
- Tách `QuantityStepper`, `Button`, `Alert` (design-system §9) rồi thay phần style viết thẳng trong `AddToCart.tsx`.
