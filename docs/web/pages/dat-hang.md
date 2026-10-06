# Đặt hàng `/checkout`

Code: `features/orders/pages/CheckoutPage.tsx`, `features/orders/lib/checkoutStorage.ts`. Nghiệp vụ: `docs/business/ordering.md` (BR-01 … BR-09). Đọc kèm [design-system.md](../design-system.md).

Bố cục: header thu gọn (chỉ logo và "Quay lại giỏ"), các khối có số thứ tự bên trái, khối tóm tắt bên phải. Black Magic chỉ có **một bước điền** (địa chỉ) và một cách thanh toán cố định (COD), nên trang ngắn hơn nhiều.

## 1. Đường dẫn và dữ liệu

- Phải đăng nhập (BR-01). Vào từ nút "Đặt hàng" ở giỏ; danh sách món đã tick đi theo `location.state` và được lưu `sessionStorage` để F5 không mất.
- Mỗi món chỉ có `productId`, `name`, `price`, `quantity` (không có ảnh).
- Gửi `POST /api/v1/orders` với `items[{productId, quantity, expectedPrice}]`, `shippingAddress{fullName, phone, address, province}` và header `Idempotency-Key` (BR-04; code đã xử lý giữ/đổi key).
- Thành công → `/orders/{orderId}` (`replace`), trang đơn hiện `Alert success`.
- Phí vận chuyển luôn "Miễn phí"; tổng = tổng (giá × số lượng); COD (BR-05, BR-06).

## 2. Bố cục

Trang dùng `FocusLayout` (design-system §9.16): header thu gọn, không có ô tìm kiếm và hàng chip, để khách tập trung đặt hàng. Link bên phải header: "Quay lại giỏ hàng" (icon `ArrowLeft`) → `/cart`.

```
H1 Đặt hàng                                         
┌ ① Thông tin giao hàng ────────────────────┐ ┌ Đơn hàng (2 sản phẩm) ─┐
│ Họ và tên *          Số điện thoại *      │ │ Tên món A        × 1    │
│ [               ]    [               ]    │ │               8.490.000₫│
│ Địa chỉ *                                 │ │ Tên món B        × 2    │
│ [                                     ]   │ │               1.980.000₫│
│ Tỉnh / Thành phố *                        │ │ ─────────────────────── │
│ [                 ]                       │ │ Tạm tính       …₫       │
└───────────────────────────────────────────┘ │ Phí vận chuyển Miễn phí │
┌ ② Thanh toán ─────────────────────────────┐ │ Tổng cộng      …₫       │
│ [💵 Thanh toán khi nhận hàng (COD)]       │ │ [Alert lỗi nếu có]      │
└───────────────────────────────────────────┘ │ [Xác nhận đặt hàng]     │
                                              └─────────────────────────┘
```

| Phần | Giá trị |
|---|---|
| Khung | rộng tối đa **1280px**, căn giữa, lề `--gutter`; cách header 24px |
| Tiêu đề | `<h1>` 24/32/600 "Đặt hàng", cách nội dung 16px |
| Lưới (≥960) | `grid-template-columns: minmax(0,1fr) 360px; gap:24px; align-items:start` (design-system §5) |
| Cột trái | các khối bước xếp dọc, cách nhau 16px |
| Cột phải | `OrderSummary`, `position: sticky; top: 24px` (header thu gọn không dính nên dính được) |

## 3. Các khối

### 3.1 Khối bước (`CheckoutStep`, riêng trang này)
`<section aria-labelledby>`: `--bg-surface`, viền `--border-divider`, bo 16px, padding 24px (<640: 16px).
- Đầu khối: số thứ tự trong vòng tròn 28px (nền `--bg-surface-raised`, viền `--border-default`, chữ 14/20/600, `aria-hidden`) + `<h2>` 20/28/600, gap 12px; cách nội dung 20px.
- Từ 1280px: đầu khối thành cột trái rộng 200px, nội dung bên phải (`grid-template-columns: 200px minmax(0,1fr); gap:24px`).
- Nội dung form rộng tối đa 640px.

### 3.2 ① Thông tin giao hàng
`<form id="checkout-form" noValidate>`, các ô là `Field` cỡ **48px** (design-system §9.4):
| Ô | Kiểu | Thuộc tính | Gợi ý dưới ô |
|---|---|---|---|
| Họ và tên * | text | `autocomplete="name"`, `maxLength=100` | — |
| Số điện thoại * | tel | `autocomplete="tel"`, `inputMode="tel"`, `maxLength=16`, placeholder "0912 345 678" | "Shipper gọi số này khi giao hàng." |
| Địa chỉ * | text | `autocomplete="street-address"`, `maxLength=200`, placeholder "Số nhà, tên đường, phường/xã" | — |
| Tỉnh / Thành phố * | text | `autocomplete="address-level1"`, `maxLength=100`, placeholder "TP. Hồ Chí Minh" | — |

- Lưới form: từ 640px `grid-template-columns: 1fr 1fr; gap:16px`; Họ tên và SĐT cùng hàng, Địa chỉ chiếm cả hàng, Tỉnh/Thành nửa hàng. Dưới 640px một cột.
- Kiểm tra khi bấm xác nhận (giữ câu chữ trong code: "Vui lòng nhập họ tên", "Số điện thoại không hợp lệ"…); sau lần bấm đầu thì kiểm lại từng ô khi rời ô. Có lỗi → focus vào ô lỗi đầu tiên.

### 3.3 ② Thanh toán
Một ô cố định (không phải lựa chọn, vì chỉ có COD): nền `--bg-surface-raised`, viền `--border-default`, bo 8px, padding `12px 16px`, gap 12px. Icon `Banknote` 24px `--fg-success` + hai dòng: "Thanh toán khi nhận hàng (COD)" 16/24/500; "Trả tiền mặt cho shipper đúng số tiền ở mục Tổng cộng, không phát sinh thêm." 14/20 `--fg-subdued`. Không dùng emoji 💵 như code hiện tại.

### 3.4 Đơn hàng (cột phải)
`OrderSummary` (design-system §9.15):
- Tiêu đề "Đơn hàng ({N} sản phẩm)".
- Danh sách món (`<ul>`, gap 12px, cách tiêu đề 16px): mỗi món tên 14/20 tối đa 2 dòng + "× {số lượng}" 12/18 `--fg-subdued`, bên phải thành tiền 14/20/600 `tabular-nums`. Món vừa đổi giá (sau `PRICE_CHANGED`): thêm `Badge warning` "Giá mới" dưới tên.
- Đường kẻ, rồi Tạm tính / Phí vận chuyển "Miễn phí" / **Tổng cộng**.
- `Alert` lỗi đặt hàng (nếu có) ngay trên nút.
- Nút `Button primary lg` 100%, `type="submit" form="checkout-form"`: "Xác nhận đặt hàng". Đang gửi: "Đang đặt hàng…", `aria-busy`, vô hiệu.

Nút nằm trong khối tóm tắt (cạnh con số tổng) để khách thấy số tiền ngay lúc bấm; nhờ thuộc tính `form` nó vẫn gửi form bên trái.

## 4. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Không có món (vào thẳng URL, hết phiên) | `EmptyState`: "Chưa có sản phẩm nào để đặt." + nút `secondary md` "Quay lại giỏ hàng" |
| Lỗi ô nhập | design-system §9.4 |
| `PRICE_CHANGED` | `Alert warning`: "Giá đã thay đổi. Tóm tắt đơn đã cập nhật giá mới, vui lòng kiểm tra rồi bấm xác nhận lại." + danh sách "Tên: giá cũ → giá mới"; các món đổi giá có nhãn "Giá mới"; tổng cập nhật |
| `OUT_OF_STOCK` | `Alert danger` + danh sách món và số còn lại + link "Quay lại giỏ hàng để điều chỉnh" |
| `ORDER_IN_PROGRESS` | `Alert warning` "Đơn của bạn đang được xử lý. Vui lòng đợi vài giây rồi bấm lại; bạn sẽ không bị đặt trùng." |
| Lỗi mạng | `Alert danger` "Không kết nối được máy chủ. Bấm đặt hàng lại sẽ không tạo đơn trùng." |
| Đang gửi | nút "Đang đặt hàng…", các ô vẫn xem được nhưng `readOnly` |

Sau khi `Alert` xuất hiện, chuyển focus tới nó (`tabIndex={-1}`).

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| ≥1280 | Khối bước có cột tiêu đề 200px bên trái |
| 960–1279 | Hai cột; tiêu đề khối bước nằm trên nội dung |
| <960 | Một cột theo thứ tự: ① Giao hàng → ② Thanh toán → Đơn hàng (không dính) với nút xác nhận ở cuối. Ô nhập chữ 16px |

## 6. Trợ năng
- Một `<h1>`; mỗi khối bước `<section aria-labelledby>` với `<h2>`; vòng số thứ tự `aria-hidden` (số đã nằm trong thứ tự đọc).
- Ô bắt buộc có `required` + `aria-required`; dấu `*` có `aria-hidden` và chú thích "* bắt buộc" 12/18 `--fg-subdued` ở đầu form.
- Lỗi ô: `aria-invalid` + `aria-describedby`.
- `Alert` lỗi đặt hàng dùng `role="alert"`.

## 7. Ngoài phạm vi
Ô email và đăng ký nhận SMS; chọn nhận tại cửa hàng hoặc giao hàng, ngày nhận; người nhận hàng hộ; thẻ tín dụng, ví điện tử, thẻ quà tặng, điểm thưởng; địa chỉ thanh toán; thuế; dòng "Bạn tiết kiệm được …"; gói quà; tách đơn theo cách nhận; bảo hành kèm món. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md).

## 8. Việc còn lại
- Tỉnh / Thành phố đang là ô chữ tự do. Đổi thành select cần danh sách tỉnh thành chuẩn (sau sáp nhập 2025) và sửa OpenAPI; chưa có trong nghiệp vụ, giữ ô chữ.
- Tách `Field`, `Alert`, `OrderSummary`; bỏ style viết thẳng trong `CheckoutPage.tsx`.
- Thêm `FocusLayout` vào router cho `/checkout`.
