# Đơn hàng `/orders` và `/orders/:orderId`

Code: `features/orders/pages/OrderListPage.tsx`, `features/orders/pages/OrderDetailPage.tsx`, `features/orders/types.ts`. Nghiệp vụ: `docs/business/ordering.md` (BR-10, BR-13, BR-14, máy trạng thái đơn). Đọc kèm [design-system.md](../design-system.md).

Bản chốt 09/11/2026. Hai trang của khách đã đăng nhập: **Đơn hàng của tôi** (lịch sử đơn) và **chi tiết một đơn** (trạng thái, món, địa chỉ, tiền, huỷ đơn). Cùng khung hẹp 1280px với giỏ hàng và đặt hàng. Những gì không làm: mục 7.

## 1. Đường dẫn và dữ liệu

- **Phải đăng nhập** (`useRequireSignIn`): chưa đăng nhập thì sang `/login` với `from` là trang đang mở, đăng nhập xong quay lại đúng trang đó.
- `GET /api/v1/orders?limit=&cursor=` trả `{ items: OrderSummary[], nextCursor? }`, mới nhất trước, mặc định 20 đơn.
- `GET /api/v1/orders/{orderId}` trả `Order`. Đơn của người khác hoặc mã sai → 404 (không để lộ đơn đó có tồn tại).
- Huỷ đơn: `DELETE /api/v1/orders/{orderId}` (BR-10). Thành công trả `Order` đã `CANCELLED`; đơn vừa chuyển sang `SHIPPED` thì 409 `CANNOT_CANCEL`.

**Ghép dữ liệu API với giao diện:**

| Trường | Hiện ở đâu | Ghi chú |
|---|---|---|
| `OrderSummary.firstItemName` | Tên đơn ở danh sách | **Trường mới** (PR backend đi kèm, xem mục 8). Tên món đầu tiên của đơn (thứ tự món lúc đặt), lấy từ `items[0].name` đã lưu sẵn trong bản ghi đơn; không đổi bảng, không đọc thêm. Đơn luôn có ít nhất 1 món |
| `OrderSummary.itemCount` | "… và N sản phẩm khác" (N = `itemCount − 1`), "· 3 sản phẩm" | Số **loại** sản phẩm (số dòng), không phải tổng số lượng |
| `orderId` | Dòng chữ mờ "Mã đơn …" | ULID 26 ký tự, `--font-mono`, hiện đủ, không rút gọn. Dùng khi khách cần báo mã đơn |
| `status` | `Badge` (design-system §9.7) và thanh trạng thái | Chữ lấy từ `STATUS_LABEL` |
| `createdAt` | "Đặt lúc 09/11/2026 10:24"; giờ ở bước "Chờ xác nhận" | Dùng `formatDateTime` có sẵn trong `shared/lib/format.ts` (giờ Việt Nam, `dd/MM/yyyy HH:mm`, cùng định dạng trang admin) |
| `updatedAt` | Giờ ở bước hiện tại; giờ huỷ khi `CANCELLED` | API **không lưu giờ của từng bước**, nên chỉ bước đầu và bước hiện tại có giờ. Bỏ giờ ở bước hiện tại khi trùng phút với `createdAt` |
| `items[{productId, name, price, quantity}]` | Khối "Sản phẩm"; tên đơn ở trang chi tiết | Giá là **giá lúc đặt** (snapshot), không phải giá hiện tại |
| `totalAmount`, `shippingFee` | Khối "Thanh toán" | `shippingFee` luôn 0 → chữ "Miễn phí" |
| `shippingAddress` | Khối "Giao tới" | Chỉ có ở `GET /orders/{id}`; danh sách không trả địa chỉ (threat model O8) |
| `paymentMethod` | Chú thích COD | Luôn `COD` |

**Tên đơn** (cùng một hàm `orderTitle` trong `features/orders/lib/`, dùng ở cả hai trang và hộp thoại huỷ):
- 1 sản phẩm: tên món đó.
- Nhiều sản phẩm: tên món đầu + "và {N} sản phẩm khác".
- Trang danh sách dùng `firstItemName` + `itemCount`; trang chi tiết dùng `items[0].name` + `items.length`.

## 2. Bố cục chung

| Phần | Giá trị |
|---|---|
| Khung | rộng tối đa **1280px**, căn giữa trong lề `--gutter` (như giỏ hàng, design-system §5) |
| Header | header đầy đủ; link "Đơn hàng" trên header có gạch chân trắng 2px (trang hiện tại, §9.1) |
| Khối | `--bg-surface`, viền 1px `--border-divider`, bo 16px, padding 24px (<640: 16px). Khác trang chi tiết sản phẩm: **không** tràn hết bề ngang trên điện thoại, giữ lề 16px và bo 16px như giỏ hàng |

## 3. Đơn hàng của tôi `/orders`

```
H1 Đơn hàng của tôi
┌ Khối danh sách ───────────────────────────────────────────────────────┐
│ Laptop ASUS TUF Gaming A15 … và 2 sản phẩm khác [Chờ xác nhận]  30.360.000₫ › │
│ Đặt lúc 09/11/2026 10:24 · 3 sản phẩm                                  │
│ Mã đơn 01M4QD8T2H7V9C3X5B1N6R8DWQ                                      │
├───────────────────────────────────────────────────────────────────────┤
│ Màn hình LG 27UP850N-W 27 inch 4K [Đã xác nhận]           9.990.000₫ › │
└───────────────────────────────────────────────────────────────────────┘
                          [ Xem thêm đơn ]
```

| Phần | Giá trị |
|---|---|
| Tiêu đề | `<h1>` 24/32/600 "Đơn hàng của tôi" (<640: 20/28); cách header 32px (16px của `<main>` + 16px của trang), cách khối 16px. Không ghi tổng số đơn (API không trả tổng) |
| Khối danh sách | `<ul>` trong một khối (mục 2), `overflow:hidden`; các dòng cách nhau bằng viền trên 1px `--border-divider` |
| Dòng | Cả dòng là **một** `<a>` tới `/orders/{orderId}`. Padding `16px 24px`; lưới `minmax(0,1fr) auto 20px`, gap cột 24px, gap hàng 4px; hover nền `--bg-surface-raised` và tên đổi `--fg-primary`; focus: viền focus bên trong dòng (`outline-offset:-2px`) |
| Hàng 1 | Tên đơn 16/24/500 `--fg-heading`, **một dòng**: phần tên món cắt `…`, phần "và N sản phẩm khác" luôn hiện đủ (`flex:none`); `Badge` trạng thái cách 8px |
| Hàng 2 | "Đặt lúc {formatDateTime(createdAt)} · {itemCount} sản phẩm" 14/20 `--fg-subdued` |
| Hàng 3 | "Mã đơn {orderId}" 12/18 `--fg-subdued`, mã dùng `--font-mono` 12px |
| Cột 2 | Tổng tiền `Price md` căn phải, nằm giữa theo chiều cao dòng |
| Cột 3 | `ChevronRight` 20 `--fg-subdued` |
| Xem thêm | Còn `nextCursor` → nút `Button secondary md` "Xem thêm đơn" căn giữa, cách khối 24px; bấm thì nối thêm đơn vào cuối danh sách (`useInfiniteQuery`), đang tải "Đang tải…" `aria-busy`. Hết `nextCursor` thì ẩn nút |

Không lọc theo trạng thái, không tìm đơn (nghiệp vụ không có).

## 4. Chi tiết đơn `/orders/:orderId`

```
‹ Đơn hàng của tôi
H1 Laptop ASUS TUF Gaming A15 … và 2 sản phẩm khác  [Chờ xác nhận]
Đặt lúc 09/11/2026 10:24 · Mã đơn 01M4QD8T2H7V9C3X5B1N6R8DWQ
[Alert success Đặt hàng thành công!]                      (chỉ khi vừa đặt)
┌ Trạng thái ────────────────────────────┐ ┌ Thanh toán (360px) ───┐
│ ●━━━━━━━━○━━━━━━━━○━━━━━━━━○            │ │ Tạm tính (3 sản phẩm)  │
│ Chờ xác nhận  Đã xác nhận  Đang giao  Đã giao│ │ Phí vận chuyển Miễn phí│
│ (i) Hệ thống đang xác nhận đơn…         │ │ Tổng cộng   30.360.000₫│
└────────────────────────────────────────┘ │ COD · trả khi nhận     │
┌ Sản phẩm (3) ──────────────────────────┐ │ [ Huỷ đơn ] (danger)   │
│ Tên món A                   24.990.000₫ │ │ Huỷ được khi đơn chưa… │
│ 24.990.000₫ × 1                         │ └────────────────────────┘
└────────────────────────────────────────┘
┌ Giao tới ──────────────────────────────┐
│ Nguyễn Minh Hoàng · 0912 345 678 · địa chỉ │
└────────────────────────────────────────┘
```

| Phần | Giá trị |
|---|---|
| Link quay lại | "‹ Đơn hàng của tôi" (icon `ChevronLeft` 16 + chữ 14/20/500 `--fg-primary`, gap 4px), padding `16px 0 12px`, tới `/orders`. Thay cho breadcrumb |
| Đầu trang | `<h1>` = tên đơn (mục 1), 24/32/600 (<640: 20/28), **tối đa 2 dòng** rồi cắt `…`; `Badge` trạng thái cạnh tiêu đề, gap 12px, xuống dòng được. Dưới, cách 4px: "Đặt lúc {formatDateTime(createdAt)} · Mã đơn {orderId}" 14/20 `--fg-subdued`, mã 12px `--font-mono` |
| Thông báo | `Alert` đặt ngay dưới đầu trang, cách 16px, rộng hết khung (xem mục 5) |
| Lưới (≥960) | `grid-template-columns: minmax(0,1fr) 360px; gap:24px; align-items:start`, cách đầu trang 24px. Cột trái 3 khối xếp dọc cách 16px. Khối Thanh toán **không dính** (trang ngắn) |
| <960 | Một cột: Trạng thái → Sản phẩm → Giao tới → Thanh toán (nút Huỷ đơn ở cuối), gap 16px |

### 4.1 Khối Trạng thái (`OrderStatusSteps`, design-system §9.26)
`<section aria-labelledby>` + `<h2>` "Trạng thái" 20/28/600, cách nội dung 16px.
- 4 bước `PENDING → CONFIRMED → SHIPPED → DELIVERED`, nhãn theo `STATUS_LABEL`. Số đo ở §9.26.
- Giờ: bước "Chờ xác nhận" ghi `createdAt`; bước hiện tại ghi `updatedAt` (mục 1). Các bước khác không ghi giờ.
- Dưới thanh, cách 20px, một ô ghi chú: nền `--bg-surface-raised`, bo 8px, padding `12px 16px`, icon `Info` 20 `--fg-primary` + chữ 14/20 `--fg-muted`:

| Trạng thái | Câu ghi chú |
|---|---|
| `PENDING` | "Hệ thống đang xác nhận đơn, thường chỉ mất vài giây. Email xác nhận sẽ được gửi khi đơn được xác nhận." |
| `CONFIRMED` | "Đơn đã được xác nhận và đang chờ giao cho đơn vị vận chuyển. Bạn vẫn huỷ được đơn ở bước này." |
| `SHIPPED` | "Đơn đã giao cho đơn vị vận chuyển. Shipper sẽ gọi số điện thoại bên dưới trước khi giao." |
| `DELIVERED` | "Đơn đã giao thành công." |

- `CANCELLED`: **không** vẽ thanh 4 bước (API không cho biết đơn bị huỷ ở bước nào). Thay bằng một hàng: icon `CircleX` 24 `--fg-danger` + "Đơn đã huỷ" 16/24/600 `--fg-heading`, dưới là "Lúc {updatedAt}" 14/20 `--fg-subdued`; không có ô ghi chú.
- Trạng thái chỉ tải lại khi khách mở lại trang hoặc tải lại; không tự hỏi lại server theo chu kỳ.

### 4.2 Khối Sản phẩm
`<h2>` "Sản phẩm ({items.length})". `<ul>`, mỗi món một dòng, lưới `minmax(0,1fr) auto`, gap 16px, các dòng cách nhau bằng viền trên `--border-divider` và padding dọc 12px (dòng đầu không có padding trên, dòng cuối không có padding dưới):
- Trái: tên món là link tới `/products/{productId}`, 14/20/500 `--fg-default` (hover `--fg-primary`), tối đa 2 dòng; dưới là "{giá} × {số lượng}" 12/18 `--fg-subdued`.
- Phải: thành tiền 14/20/600 `tabular-nums`.
- Không có ảnh (OrderItem không có ảnh hay loại hàng). Sản phẩm đã ngừng bán thì link vẫn để; trang chi tiết sản phẩm tự hiện 404.

### 4.3 Khối Giao tới
`<h2>` "Giao tới". Ba dòng 14/20 `--fg-muted`, gap 4px: họ tên (600 `--fg-default`), số điện thoại, "{address}, {province}".

### 4.4 Khối Thanh toán (`OrderSummary`, design-system §9.15)
- Tiêu đề "Thanh toán". Dòng "Tạm tính ({N} sản phẩm)" (N = số món) và "Phí vận chuyển" "Miễn phí"; đường kẻ; "Tổng cộng" + `Price md`.
- Dưới tổng, cách 24px, gap 8px: chú thích icon `Banknote` 16 + "Thanh toán khi nhận hàng (COD): trả tiền mặt cho shipper đúng số tiền ở mục Tổng cộng." 12/18 `--fg-subdued`.
- Đơn `PENDING` hoặc `CONFIRMED` (`CUSTOMER_CANCELLABLE`, BR-10): nút `Button danger lg` rộng 100% "Huỷ đơn", cách chú thích 8px; dưới nút "Huỷ được khi đơn chưa giao cho đơn vị vận chuyển." 12/18 `--fg-subdued`. Trạng thái khác: không có nút, không có dòng này.
- Trang này **không có** nút `primary`.

### 4.5 Hộp thoại huỷ đơn (`ConfirmDialog`, design-system §9.14)
- Dùng `ConfirmDialog` có sẵn (trang admin), thêm prop `tone="danger"` cho nút xác nhận (mặc định `primary` như admin).
- Bấm "Huỷ đơn" mở hộp thoại; **không** huỷ ngay.
- Tiêu đề "Huỷ đơn này?"; nội dung "Đơn “{tên đơn}” sẽ bị huỷ và không khôi phục được. Muốn mua lại thì bạn đặt đơn mới."
- Nút "Giữ đơn" (`secondary`, nhận focus đầu tiên: `showModal` tự focus nút đầu trong hộp) + "Huỷ đơn" (`danger`). Dưới 640px xếp dọc, nút "Huỷ đơn" ở trên.
- Đang gửi: nút đổi "Đang huỷ…" (`aria-busy`), Esc, vùng tối và "Giữ đơn" không đóng hộp.
- Thành công: đóng hộp, ghi kết quả vào cache chi tiết, làm mới danh sách đơn; trang hiện `Alert success` "Đã huỷ đơn." (`role="status"`), khối Trạng thái đổi sang "Đơn đã huỷ", nút Huỷ đơn biến mất. Focus về tiêu đề trang.
- `CANNOT_CANCEL`: đóng hộp, tải lại đơn, hiện `Alert danger` "Đơn đã được giao cho đơn vị vận chuyển, không huỷ được nữa." Lỗi khác (mạng): giữ hộp mở, `Alert danger` "Không huỷ được đơn, vui lòng thử lại." ngay trên hàng nút.

## 5. Trạng thái

| Trang | Trạng thái | Hiển thị |
|---|---|---|
| Danh sách | Đang tải | khối danh sách với 4 dòng khung chờ (thanh 20px rộng ≤420px + thanh 14px rộng 220px; cột phải thanh 20px rộng 120px), gradient chờ §9.12, `aria-busy` |
| Danh sách | Chưa có đơn | `EmptyState`: icon `Package` 48 `--fg-icon-soft`, "Bạn chưa có đơn hàng nào.", nút `Button primary md` "Mua sắm ngay" → `/products` |
| Danh sách | Lỗi tải | "Chưa tải được đơn hàng. Tải lại trang để thử lần nữa." 14/20 `--fg-subdued`, `role="alert"` |
| Danh sách | Lỗi khi bấm "Xem thêm đơn" | giữ các đơn đã có; dưới nút dòng `role="alert"` "Chưa tải thêm được. Bấm lại để thử lần nữa." |
| Chi tiết | Đang tải | link quay lại + thanh tiêu đề 32px + thanh 16px; khung chờ cột trái 2 khối (168px, 220px), cột phải 260px, bo 16px, `aria-busy` |
| Chi tiết | 404 | link quay lại + `EmptyState`: icon `Search` 48, "Không tìm thấy đơn hàng này.", nút `secondary md` "Xem đơn hàng của tôi" → `/orders`. Không tự thử lại |
| Chi tiết | Lỗi tải | "Chưa tải được đơn hàng. Tải lại trang để thử lần nữa." `role="alert"` |
| Chi tiết | Vừa đặt xong (`state.justCreated` từ trang đặt hàng) | `Alert success` (`role="status"`, nhận focus): dòng 1 đậm 600 "Đặt hàng thành công!", dòng 2 "Email xác nhận sẽ được gửi trong ít phút. Bạn thanh toán khi nhận hàng." Mất khi tải lại trang (state không còn). Không có trang "Cảm ơn" riêng |
| Chi tiết | Đã huỷ / huỷ lỗi | mục 4.5 |

## 6. Responsive và trợ năng

| Màn | Khác biệt |
|---|---|
| ≥960 | Như mục 3, 4 |
| <960 | Chi tiết đơn một cột (mục 4) |
| <640 | Lề 16px, khối bo 16px padding 16px. Dòng đơn: lưới `minmax(0,1fr) 20px`; tên món tối đa 2 dòng, "và N sản phẩm khác" xuống dòng riêng 14/20 `--fg-muted`; `Badge` xuống dòng dưới tên; tổng tiền thành hàng cuối, căn trái. Thanh trạng thái **dọc**: chấm bên trái, nhãn và giờ bên phải, vạch nối dọc 4px giữa các chấm |

- Mỗi trang một `<h1>`; các khối là `<section aria-labelledby>` với `<h2>`.
- Danh sách là `<ul>`; mỗi dòng một link duy nhất, chữ link đọc đủ tên đơn, trạng thái, ngày, tổng tiền (nội dung của dòng nằm trong link).
- Thanh trạng thái là `<ol>`, bước hiện tại `aria-current="step"`; chấm `aria-hidden`.
- Hộp thoại huỷ: `<dialog>` gốc, `aria-labelledby` + `aria-describedby`; đóng thì trả focus về nút "Huỷ đơn" (khi giữ đơn) hoặc tiêu đề trang (khi đã huỷ).
- `Alert` thành công `role="status"`, lỗi `role="alert"`.

## 7. Ngoài phạm vi
Theo dõi vận chuyển, mã vận đơn; hoá đơn, in đơn; "Mua lại"; đổi trả, hoàn tiền; liên hệ hỗ trợ; chọn lý do huỷ; lọc, tìm đơn; mã đơn rút gọn do web tự đặt; ảnh món trong đơn; tự cập nhật trạng thái theo thời gian thực. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md), [ordering.md](../../business/ordering.md).

## 8. Việc còn lại
- **API:** thêm `firstItemName` (bắt buộc, chuỗi) vào `OrderSummary` trong `contracts/openapi.yaml`; backend lấy từ `items[0].name` trong `toSummary` (cột `items` đã có trong `ProjectionExpression` của lịch sử đơn, không đổi bảng, không đọc thêm). API admin (`AdminOrderSummary`, `additionalProperties: false`) **không đổi**: `listAdminOrders` đã chép từng trường nên trường mới không lọt ra.
- Tách `Badge`, `EmptyState`, `Button` (design-system §9) nếu PR trước chưa tách.
