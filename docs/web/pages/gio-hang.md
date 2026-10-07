# Giỏ hàng `/cart`

Code: `features/cart/pages/CartPage.tsx`, `features/cart/lib/selection.ts`. Nghiệp vụ: `docs/business/cart.md` (BR-01 … BR-09), `docs/business/ordering.md` (BR-02). Đọc kèm [design-system.md](../design-system.md).

Bố cục: danh sách món bên trái, khối tóm tắt đơn bên phải, mỗi món có ảnh vuông, tên, giá bên phải, bộ chọn số lượng và link "Xoá" ngay dưới giá. Mỗi món **có ô tick chọn** để đặt một phần giỏ (cart BR-07, BR-09). Không có nhận tại cửa hàng, lưu để mua sau, bảo hành ([ngoai-pham-vi.md](../ngoai-pham-vi.md)).

## 1. Đường dẫn và dữ liệu

- **Không bắt đăng nhập** (cart BR-01). Code chỉ dùng hook `features/cart/hooks/useCart.ts`, hook tự chọn nguồn giỏ:
  - Khách vãng lai: giỏ khách trong `localStorage` (`features/cart/lib/guestCart.ts`, khoá `shop-ai:guest-cart`); tên, ảnh, giá, tồn kho lấy từ `GET /api/v1/products/{id}` cho từng dòng. Sản phẩm 404 → hiện "Sản phẩm không còn bán", nhãn Ngừng bán, để khách tự xoá. Giới hạn 99 / tồn kho / 50 dòng kiểm ngay trên trình duyệt, lỗi mang cùng mã với API.
  - Đã đăng nhập: giỏ tài khoản qua API như dưới đây.
- `GET /api/v1/cart` trả `{ items, totalAmount }`. Mỗi `CartItem`: `productId`, `name`, `imageUrl?`, `price` (giá **hiện tại**), `quantity`, `stock`, `status`, `priceChanged?`. Không có hãng hay loại hàng.
- Sửa số lượng `PUT /cart/items/{id}`, xoá `DELETE /cart/items/{id}`; xong thì tải lại giỏ.
- **Tick chọn** chỉ nằm ở trình duyệt (`selection.ts`): mặc định chọn mọi món đặt được; món không đặt được (Hết hàng, Ngừng bán, Chỉ còn X < số trong giỏ) không tick được.
- Tổng trên trang = tổng các món **đang tick** (BR-09), tính ở web; không dùng `totalAmount` để hiển thị.
- "Đặt hàng" → `/checkout` mang theo các món đã tick. **Khách vãng lai**: lưu các món đã tick (`saveCheckoutIntent`), sang `/login` với `{ from: '/checkout', reason: 'checkout' }`; đăng nhập xong gộp giỏ và đi tiếp theo cart BR-11 (`features/cart/lib/afterSignIn.ts`). Dưới nút có dòng 12/18 `--fg-subdued`: "Bạn sẽ đăng nhập hoặc tạo tài khoản ở bước tiếp theo. Các món đã chọn được giữ nguyên."
- **Sau khi gộp** (đến từ `/login`) mà có thay đổi: chỉ đưa về trang giỏ, **không** hiện thông báo riêng (số lượng, nhãn "Chỉ còn X", "Giá đã thay đổi" trên từng dòng đã đủ). Gộp lỗi (mạng, server) → vẫn về trang giỏ. Đã đăng nhập mà trình duyệt còn giỏ khách → `Alert warning` **trong cột trái** (rộng bằng danh sách món, không lấn sang khối tóm tắt), nằm trên danh sách (hoặc trên ô giỏ rỗng): "Còn N sản phẩm bạn chọn lúc chưa đăng nhập chưa được thêm vào giỏ." + nút `secondary sm` "Gộp vào giỏ" (thử lại cùng `Idempotency-Key` nên không cộng dồn hai lần). Máy tính: icon, chữ, nút cùng hàng, nút sát mép phải khung. Điện thoại (<640): nút xuống dòng dưới chữ, thẳng lề trái với chữ. Bấm mà vẫn lỗi → khung đổi sang `danger` "Vẫn chưa gộp được. Kiểm tra kết nối rồi thử lại."
- Widget "Thường mua kèm" dưới giỏ (ADR-0016, An làm): `GET /api/v1/recs`, đã lọc hàng hết và hàng đã có trong giỏ.

## 2. Bố cục

```
H1 Giỏ hàng  (3 sản phẩm)
┌ Danh sách ───────────────────────────────────────┐ ┌ Tóm tắt (360px) ───┐
│ [✓] Chọn tất cả (3)                              │ │ Tóm tắt đơn hàng   │
├──────────────────────────────────────────────────┤ │ Tạm tính (2)  …₫   │
│ [✓] ┌ảnh┐ Tên sản phẩm 2 dòng       8.490.000₫  │ │ Phí vận chuyển     │
│     │96 │ [Giá đã thay đổi]          [−][1][+]  │ │         Miễn phí   │
│     └───┘                                  Xoá   │ │ ────────────────── │
├──────────────────────────────────────────────────┤ │ Tổng cộng  …₫      │
│ [ ] ┌ảnh┐ Tên … [Hết hàng]               …        │ │ [ Đặt hàng (2) ]   │
└──────────────────────────────────────────────────┘ │ COD · trả khi nhận │
                                                     └────────────────────┘
┌ Thường mua kèm (widget của An) — toàn bề ngang khung ───────────────────┐
```

| Phần | Giá trị |
|---|---|
| Khung | rộng tối đa **1280px**, căn giữa trong lề `--gutter` (giỏ hàng không cần trải rộng 1920) |
| Tiêu đề | `<h1>` 24/32/600 "Giỏ hàng" + số dòng "(3 sản phẩm)" 14/20 `--fg-subdued` cùng hàng, cách 8px; cách hàng chip của header **32px** (16px của `<main>` + 16px của trang), cách nội dung 16px |
| Lưới (≥960) | `grid-template-columns: minmax(0,1fr) 360px; gap:24px; align-items:start` (bố cục 2 cột, design-system §5) |
| Danh sách | một khối: `--bg-surface`, viền `--border-divider`, bo 16px, `overflow:hidden`; các dòng cách nhau bằng viền trên 1px `--border-divider` |
| Tóm tắt | `OrderSummary` (design-system §9.15) |
| Thường mua kèm | dưới lưới, cách 32px, rộng hết khung 1280px |

## 3. Các khối

### 3.1 Hàng "Chọn tất cả"
Padding `12px 24px`, nền `--bg-surface-raised`. `Checkbox` + nhãn "Chọn tất cả ({số món tick được})" 14/20/500. Bấm: đang chọn hết thì bỏ hết, ngược lại chọn hết (`toggleAll`). Khi chỉ chọn một phần: checkbox ở trạng thái `indeterminate` (gạch ngang, nền tím).

### 3.2 Dòng sản phẩm
`<li>` padding 24px (<640: 16px), lưới:
```
grid-template-columns: 20px 96px minmax(0,1fr) auto;
column-gap: 16px;  align-items: start;
```
| Cột | Nội dung |
|---|---|
| 1 | `Checkbox`, nhãn ẩn "Chọn {tên}", căn giữa theo ảnh (`align-self:center`) |
| 2 | Ô ảnh 96×96, `--bg-image-plate`, bo 8px, padding 8px, ảnh `contain` + `multiply`, `alt=""`; là link tới trang sản phẩm. Không có ảnh → icon `Package` 32px màu `--border-input` |
| 3 | **Tên**: link 16/24/500 `--fg-default` (hover `--fg-primary`), tối đa 2 dòng. Dưới tên, cách 8px, hàng nhãn (gap 8px, tự xuống dòng): `Badge` lý do không đặt được (BR-07: "Hết hàng" / "Ngừng bán" danger, "Chỉ còn X sản phẩm" warning), `Badge warning` "Giá đã thay đổi" khi `priceChanged`. Món "Chỉ còn X" có thêm nút `secondary sm` "Giảm về X" ngay cạnh nhãn |
| 4 | Căn phải, xếp dọc gap 8px: **thành tiền** `Price md` (giá × số lượng); khi số lượng > 1 thêm dòng "{giá} / sản phẩm" 12/18 `--fg-subdued`; `QuantityStepper` (1 … min(99, tồn kho)); nút `ghost sm` màu `--fg-subdued` "Xoá" với icon `Trash2` 16px (hover chữ `--fg-danger`) |

- Dòng đang tick **không đổi màu nền hay viền**: ô tick đã đủ báo trạng thái, và mặc định mọi món đều được tick nên tô tím cả danh sách là thừa.
- Món không đặt được: ô ảnh opacity .6, checkbox vô hiệu. Hết hàng / Ngừng bán: bộ chọn số lượng vô hiệu, chỉ còn "Xoá". Chỉ còn X: bộ chọn vẫn dùng được để giảm.
- Đang sửa số lượng hoặc đang xoá dòng nào: dòng đó `aria-busy="true"`, opacity .6, các nút của dòng vô hiệu. Xoá không cần hộp thoại xác nhận.
- Lỗi sửa số lượng (`QUANTITY_LIMIT`, lỗi mạng): `Alert` ngay dưới tiêu đề trang, câu chữ như code ("Không thể tăng thêm: chỉ còn thêm được N sản phẩm.").

### 3.3 Tóm tắt đơn hàng
`OrderSummary` với:
| Dòng | Giá trị |
|---|---|
| Tiêu đề `<h2>` | "Tóm tắt đơn hàng" |
| Tạm tính ({N} sản phẩm) | tổng các món đang tick; N = số dòng đang tick |
| Phí vận chuyển | "Miễn phí" màu `--fg-success` (ordering BR-06) |
| Tổng cộng | bằng Tạm tính |
| Nút | `Button primary lg` 100%: "Đặt hàng ({N})". N = 0 → vô hiệu, dưới nút dòng 12/18 `--fg-subdued` "Chọn ít nhất 1 sản phẩm để đặt hàng." (ordering BR-02) |
| Chú thích | icon `Banknote` 16 + "Thanh toán khi nhận hàng (COD)" 12/18 `--fg-subdued` |

### 3.4 Thường mua kèm (widget của An)
`StoryBlock` "Thường mua kèm" + `Carousel` + `ProductCard`, giống trang chi tiết. Không có gợi ý hoặc giỏ rỗng → không render. Trên điện thoại, khối nằm trên thanh tổng dính đáy (thanh không che khối nhờ `padding-bottom` của trang bằng chiều cao thanh).

## 4. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | khung chờ 3 dòng cao 144px trong khối danh sách + khối tóm tắt cao 280px |
| Lỗi tải | "Chưa tải được giỏ hàng. Tải lại trang để thử lần nữa." `role="alert"` |
| Giỏ rỗng | **Giữ bố cục hai cột** để trang không đổi khung khi giỏ có hàng. Tiêu đề đổi thành "Giỏ hàng của bạn đang trống". Cột trái: `EmptyState` (icon `ShoppingCart` 48px, "Chưa có sản phẩm nào trong giỏ. Xem hàng mới về bên dưới, hoặc xem tất cả sản phẩm." có link `/products`), dưới là `ProductRail` "Hàng mới về" như trang chủ. Cột phải: `OrderSummary` không có dòng tạm tính, Tổng cộng 0₫, nút `primary lg` "Tiếp tục mua sắm" → `/products`. Điện thoại: không có thanh dính đáy, khối tóm tắt nằm dưới |
| Có món không đặt được | như 3.2; số trong "Chọn tất cả" chỉ đếm món tick được |
| Mọi món đều không đặt được | nút Đặt hàng vô hiệu, dòng gợi ý "Các sản phẩm trong giỏ hiện chưa đặt được." |
| Giỏ đủ 50 dòng | không hiện gì ở đây; lỗi `CART_FULL` hiện ở trang chi tiết khi thêm |

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| ≥960 | Hai cột như mục 2 |
| 640–959 | Một cột: danh sách, rồi khối tóm tắt đầy đủ bên dưới |
| <640 | Dòng sản phẩm: `grid-template-columns: 20px 72px minmax(0,1fr)`; cột 4 xuống hàng dưới, nằm từ cột 2 tới hết (`grid-column: 2 / -1`), xếp ngang: bộ chọn số lượng trái, thành tiền phải, "Xoá" xuống dòng. Khối tóm tắt **thay bằng thanh dính đáy** (`position: sticky; bottom: 0`): nền `--bg-surface`, viền trên `--border-divider`, `--shadow-up`, padding `12px 16px`; trái là "Tổng ({N})" 12/18 `--fg-subdued` + `Price md`, phải là nút `primary lg` "Đặt hàng ({N})" |

## 6. Trợ năng
- Danh sách là `<ul>`; mỗi checkbox có nhãn ẩn "Chọn {tên}"; checkbox chọn tất cả dùng `indeterminate` (đặt bằng JS, trình đọc màn hình đọc "chọn một phần").
- Nút ± có nhãn "Giảm/Tăng số lượng {tên}"; nút Xoá có nhãn "Xoá {tên} khỏi giỏ".
- Sau khi xoá một dòng, chuyển focus tới dòng kế tiếp (hoặc tiêu đề trang nếu hết) để người dùng bàn phím không bị mất chỗ.
- Tổng tiền nằm trong vùng `aria-live="polite"` để nghe được khi tick/bỏ tick.

## 7. Việc còn lại
- Widget "Thường mua kèm" (mục 3.4) chờ An làm `GET /api/v1/recs`.
- Sau khi xoá một dòng, chuyển focus tới dòng kế tiếp (mục 6) chưa làm.
- Nút trong trang đang là class riêng `primaryButton`; khi có component `Button` (design-system §9.3) thì thay.
