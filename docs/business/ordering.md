# Tính năng: Đặt hàng

- Module: ordering
- Vai trò: khách hàng đã đăng nhập; admin (huỷ đơn, chuyển trạng thái giao hàng)
- Người viết: Hoàng · Ngày: 01/10/2026 · Sửa: 03/10/2026 (tồn kho, đổi giá, huỷ đơn, trạng thái)

## Luồng đặt hàng (checkout flow)

```
[Trang sản phẩm]        [Trang giỏ hàng]              [Trang checkout]         [Hoàn thành]
  Bấm "Thêm giỏ"  →    ☑ GPU RTX 4070   4.500.000đ  →  Tóm tắt đơn       →   Đơn đã đặt
  POST /cart/items      ☑ Chuột gaming     650.000đ     Điền thông tin         Email xác nhận
                        ☐ Túi laptop       350.000đ     - Họ tên, SĐT
                        (Tick chọn món)    ─────────▶   - Địa chỉ giao
                        Chỉnh số lượng                  - Phương thức: COD
                        Bấm "Đặt hàng"                  - Phí ship: miễn phí
                        (với các món ☑)                 Bấm "Xác nhận đặt"
                                                        → POST /api/v1/orders ◀── đây mới tạo đơn
```

> **Bấm "Đặt hàng"** trên trang giỏ chỉ chuyển sang trang checkout, chưa tạo đơn.
> Đơn chỉ được tạo khi bấm **"Xác nhận đặt hàng"** sau khi điền đầy đủ thông tin.

## User story

Là khách hàng, tôi muốn tick chọn các sản phẩm trong giỏ mà tôi muốn mua lần này, điền địa chỉ giao hàng rồi xác nhận đặt để nhận hàng và trả tiền mặt khi giao (COD). Những sản phẩm không chọn vẫn còn trong giỏ cho lần mua sau.

## Quy tắc nghiệp vụ

### Tạo đơn

- BR-01: Bắt buộc đăng nhập để đặt hàng.
- BR-02: Phải tick chọn ít nhất 1 sản phẩm trước khi bấm "Đặt hàng". Một đơn có tối đa 50 dòng sản phẩm.
- BR-03: Khi bấm "Xác nhận đặt hàng", server kiểm lại từng món, không tin dữ liệu từ client:
  - `status = ACTIVE`
  - `stock >= quantity` của món đó (không chỉ `stock > 0`)
  - Có món không đạt → trả 409 `OUT_OF_STOCK` kèm danh sách món và số còn lại; không tạo đơn, không trừ kho món nào.
- BR-04: Mỗi lượt checkout, frontend sinh 1 UUID và gửi trong header `Idempotency-Key`. Bấm lại sau khi mạng lỗi thì gửi **cùng UUID đó** → server trả đơn cũ (200), không tạo đơn mới. Khoá hết hiệu lực sau 24 giờ.
  - Lần gửi trước với cùng khoá **chưa xử lý xong** → 409 `ORDER_IN_PROGRESS`; frontend giữ nguyên khoá và thử lại sau vài giây.
  - Cùng khoá nhưng **nội dung khác** (khác món, khác số lượng) → 422 `IDEMPOTENCY_KEY_REUSED`.
- BR-05: Thanh toán bằng COD (tiền mặt khi nhận hàng); không có cổng thanh toán thật.
- BR-06: **Miễn phí vận chuyển** trong MVP. `totalAmount` = tổng (giá × số lượng); khách trả đúng số tiền này khi nhận hàng, không phát sinh thêm.
- BR-07: **Giá phải khớp với giá khách đã thấy.** Frontend gửi kèm `expectedPrice` (giá đang hiển thị) cho từng món. Giá hiện tại khác `expectedPrice` → 409 `PRICE_CHANGED` kèm giá mới của các món đã đổi; không tạo đơn. Khách xem giá mới rồi bấm xác nhận lại.
- BR-08: **Trừ tồn kho nguyên tử**: trừ `stock` của mọi món, ghi đơn và xoá món khỏi giỏ trong **một giao dịch**. Mỗi lệnh trừ kho có điều kiện `stock >= quantity`, nên hai khách cùng mua món cuối cùng thì chỉ một người thành công, người còn lại nhận 409 `OUT_OF_STOCK`. Giao dịch thất bại thì không có gì thay đổi.
- BR-09: Sau khi tạo đơn thành công, **chỉ xoá các sản phẩm đã đặt** khỏi giỏ. Những sản phẩm không chọn vẫn còn nguyên.

### Huỷ đơn

- BR-10: Khách huỷ được đơn của mình khi trạng thái là `PENDING` hoặc `CONFIRMED`. Từ `SHIPPED` trở đi thì không huỷ được (409 `CANNOT_CANCEL`).
- BR-11: Admin huỷ được đơn ở `PENDING`, `CONFIRMED` hoặc `SHIPPED` (hàng hoàn về kho). Không huỷ được đơn `DELIVERED` hay đơn đã `CANCELLED`.
- BR-12: **Huỷ đơn thì hoàn tồn kho**: cộng lại `stock` cho mọi món trong đơn. Đổi trạng thái và cộng kho nằm trong một giao dịch, có điều kiện trạng thái hiện tại, nên bấm huỷ hai lần chỉ hoàn kho một lần.
- BR-13: Huỷ đơn thì gửi email báo cho khách.

## Máy trạng thái đơn hàng

```
PENDING ──► CONFIRMED ──► SHIPPED ──► DELIVERED
   │            │            │
   └────────────┴────────────┴──► CANCELLED (hoàn kho)
```

| Trạng thái | Ai chuyển | Khi nào |
|---|---|---|
| `PENDING` | Hệ thống | Ngay khi tạo đơn thành công |
| `CONFIRMED` | Worker (SQS) | Worker nhận message và xác nhận đơn |
| `SHIPPED` | Admin | Đã giao cho đơn vị vận chuyển |
| `DELIVERED` | Admin | Khách đã nhận hàng |
| `CANCELLED` | Khách (từ `PENDING`, `CONFIRMED`) hoặc admin (từ `PENDING`, `CONFIRMED`, `SHIPPED`) | Xem BR-10, BR-11 |

MVP **không có** trạng thái `FAILED`. Đơn mà worker xử lý lỗi quá 3 lần vẫn ở `PENDING`; admin xử lý theo runbook `dlq-orders.md` (chạy lại message, hoặc huỷ đơn để hoàn kho).

## Thông tin đơn hàng

| Thuộc tính | Kiểu | Ghi chú |
|---|---|---|
| `orderId` | string (ULID) | Khoá chính, sinh tự động |
| `userId` | string | Lấy từ JWT, không lấy từ body |
| `items` | array | Snapshot tại thời điểm đặt: `productId`, `name`, `price`, `quantity` |
| `totalAmount` | number (VND) | Tổng tiền, server tự tính |
| `shippingFee` | number (VND) | Luôn `0` trong MVP (BR-06) |
| `status` | enum | Xem máy trạng thái |
| `shippingAddress` | object | `fullName`, `phone`, `address`, `province` |
| `paymentMethod` | `COD` | Cố định trong MVP |
| `createdAt` | ISO 8601 UTC | |
| `updatedAt` | ISO 8601 UTC | |

## Luồng bất đồng bộ (SQS)

1. API tạo đơn (giao dịch ở BR-08) → đẩy message `{ orderId, userId, correlationId }` vào SQS → trả đơn `PENDING` ngay.
2. Worker `order-processor` nhận message:
   1. Chuyển `PENDING → CONFIRMED` bằng **ghi có điều kiện** (`status = PENDING`). Đơn đã `CONFIRMED` hoặc `CANCELLED` thì bỏ qua bước này.
   2. Gửi email xác nhận qua SES, chống gửi trùng bằng Powertools Idempotency với khoá `orderId`.
   3. Báo admin qua SNS.
3. SQS có thể giao một message nhiều lần (at-least-once). Nhờ bước 2.1 có điều kiện và bước 2.2 có idempotency, chạy lại không đổi trạng thái sai và không gửi email hai lần.
4. Email lỗi **không** làm đơn quay lại `PENDING`: trạng thái đã đổi ở bước 2.1. Message được thử lại; quá 3 lần thì vào DLQ, alarm kêu, xử lý theo runbook `dlq-orders.md`.
5. Khách huỷ đơn khi message chưa tới worker: bước 2.1 thấy đơn đã `CANCELLED` nên bỏ qua, không gửi email xác nhận.

## Trường hợp đặc biệt

- Món hết hàng hoặc không đủ số lượng → 409 `OUT_OF_STOCK` kèm `invalidItems` (productId, số còn lại).
- Món đã ngừng bán (`INACTIVE`) → 409 `OUT_OF_STOCK`, số còn lại là 0.
- Giá đổi giữa lúc xem giỏ và lúc xác nhận → 409 `PRICE_CHANGED` (BR-07).
- Thiếu `Idempotency-Key` → 400.
- Lần gửi trước với cùng `Idempotency-Key` chưa xong → 409 `ORDER_IN_PROGRESS`.
- Cùng `Idempotency-Key`, nội dung khác → 422 `IDEMPOTENCY_KEY_REUSED`.
- Xem hoặc huỷ đơn của người khác → 404 (không để lộ đơn đó có tồn tại).

## Tiêu chí nghiệm thu

- Given giỏ có 3 món còn hàng, tick chọn 2, When `POST /api/v1/orders` với Idempotency-Key, Then trả 201 `status: PENDING`, `shippingFee: 0`, và giỏ chỉ còn món chưa chọn.
- Given cùng Idempotency-Key đã đặt thành công, When gọi lại `POST /api/v1/orders`, Then trả 200 với cùng `orderId`.
- Given món A còn 2 cái, When đặt `quantity: 5`, Then trả 409 `OUT_OF_STOCK` và tồn kho món A vẫn là 2.
- Given món A còn 1 cái, When hai khách cùng đặt 1 cái gần như cùng lúc, Then đúng một đơn được tạo, khách còn lại nhận 409, và tồn kho món A là 0 (không âm).
- Given đơn có món A (đặt 3 cái) đang `PENDING`, When khách huỷ, Then đơn `CANCELLED` và tồn kho món A tăng thêm 3. Huỷ lần nữa thì trả 409, tồn kho không tăng thêm.
- Given đơn `CONFIRMED`, When khách huỷ, Then đơn `CANCELLED`.
- Given đơn `SHIPPED`, When khách huỷ, Then trả 409 `CANNOT_CANCEL`.
- Given giá món A đổi từ 500.000 lên 600.000 sau khi khách mở trang checkout, When khách xác nhận với `expectedPrice: 500000`, Then trả 409 `PRICE_CHANGED` kèm giá mới 600.000 và không tạo đơn.
- Given đặt hàng thành công, When đợi vài giây, Then đơn chuyển `CONFIRMED` và nhận được email xác nhận (kiểm tra hộp thư dev).
- Given worker nhận cùng một message hai lần, Then chỉ gửi 1 email.
- Given `GET /api/v1/orders`, Then chỉ trả đơn của người đang đăng nhập.
- Given đơn của người khác, When `GET /api/v1/orders/{orderId}`, Then trả 404.

## Màn hình liên quan

- `/checkout` — trang đặt hàng: địa chỉ giao hàng, tóm tắt đơn, dòng "Phí vận chuyển: Miễn phí", nút "Xác nhận đặt hàng". Nhận 409 `PRICE_CHANGED` thì hiện giá mới và yêu cầu xác nhận lại.
- `/orders` — lịch sử đơn: danh sách đơn kèm trạng thái.
- `/orders/:orderId` — chi tiết đơn; nút "Huỷ đơn" khi đơn còn `PENDING` hoặc `CONFIRMED`.
