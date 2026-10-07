# Thiết kế bảng DynamoDB

Người viết: Hoàng · Ngày: 01/10/2026 · Sửa: 03/10/2026 (tìm kiếm, giao dịch đặt hàng, huỷ đơn)

Nguyên tắc: **thiết kế từ truy vấn cần có → chọn khoá, không làm ngược lại**.

---

## Bảng `products` (module catalog)

### Truy vấn cần có

| # | Truy vấn | Tần suất |
|---|---|---|
| Q1 | Chi tiết sản phẩm theo `productId` | Cao |
| Q2 | Danh sách sản phẩm theo `category`, phân trang | Cao |
| Q3 | Admin: tất cả sản phẩm (kể cả INACTIVE) | Thấp |
| Q4 | Tất cả sản phẩm ACTIVE, không lọc loại (trang chủ) | Cao |
| Q5 | Tìm theo tên, không phân biệt hoa thường và dấu, khớp ở bất kỳ vị trí nào | Vừa |

### Thiết kế khoá

| Thuộc tính | Kiểu | Giá trị | Phục vụ |
|---|---|---|---|
| **PK** | String | `productId` (ULID) | Q1 — GetItem |
| **GSI1-PK** | String | thuộc tính `categoryStatus` = `category#status` (ví dụ: `gpu#ACTIVE`) | Q2 — Query trên GSI1 |
| **GSI1-SK** | String | `productId` | Q2 — phân trang bằng cursor = `productId` cuối cùng |

> **Không dùng Scan ở bất kỳ đâu.**
> DynamoDB không hỗ trợ ký tự đại diện trong khoá (`*#ACTIVE` không chạy được).
>
> - **Q3 (admin):** Query GSI1 với từng `<category>#ACTIVE` và `<category>#INACTIVE` (26 lần, chạy song song). Admin ít dùng nên chấp nhận được.
> - **Q4, Q5:** Lambda giữ danh sách sản phẩm ACTIVE trong bộ nhớ 60 giây. Hết hạn thì Query GSI1 với từng `<category>#ACTIVE` (13 lần, song song), gộp lại. Chuẩn hoá tên một lần lúc nạp, rồi lọc, sắp xếp và phân trang trên mảng này. Cursor mã hoá vị trí của sản phẩm cuối trang trước (còn hay hết hàng, giá hoặc `createdAt`, `productId`), nên vẫn đúng khi cache nạp lại giữa hai trang.
> - Cách Q4, Q5 hợp với catalog nhỏ (dưới vài nghìn sản phẩm). Xem `catalog.md` mục "Cách hiện thực tìm kiếm".

### Schema thuộc tính

```
productId    String  PK
name         String
categoryStatus String (khoá GSI byCategory, vd. gpu#ACTIVE; không trả ra API)
nameSearch   String  (tuỳ chọn, không bắt buộc: Lambda tự chuẩn hoá tên khi nạp cache; không trả ra API)
category     String  (13 loại, xem catalog.md BR-02)
brand        String
price        Number  (VND, số nguyên)
stock        Number
status       String  (ACTIVE | INACTIVE)
description  String
imageUrl     String  (tuỳ chọn)
specs        Map     (tuỳ chọn, thông số kỹ thuật)
createdAt    String  (ISO 8601 UTC)
updatedAt    String  (ISO 8601 UTC)
```

**GSI: `byCategory`**
- PK: `categoryStatus` = `category#status`; ai ghi sản phẩm (seed, admin) phải ghi kèm và cập nhật khi đổi `category` hoặc `status`
- SK: `productId`
- Chiếu: ALL

---

## Bảng `carts` (module cart)

### Truy vấn cần có

| # | Truy vấn | Tần suất |
|---|---|---|
| Q1 | Đọc giỏ của `userId` | Cao |
| Q2 | Ghi / cập nhật / xoá item trong giỏ | Cao |

### Thiết kế khoá

Giỏ hàng dùng **single-item per user** — lưu toàn bộ giỏ dưới 1 item DynamoDB với `items` là List.

| Thuộc tính | Kiểu | Giá trị |
|---|---|---|
| **PK** | String | `userId` |

> Tại sao không dùng PK=userId, SK=productId? — Mỗi thao tác giỏ cần đọc toàn bộ giỏ để tính total, nên lưu cùng 1 item + dùng update expressions sẽ nhanh và rẻ hơn.

### Schema thuộc tính

```
userId     String   PK
items      List     [{productId, quantity, addedPrice, addedAt}, ...]   tối đa 50 phần tử
updatedAt  String   (ISO 8601 UTC)
```

> `addedPrice` — giá lúc thêm hoặc sửa số lượng gần nhất; khác giá hiện tại thì bật cờ `priceChanged` (cart.md BR-06).
>
> Giới hạn 50 dòng (cart.md BR-02): mỗi dòng khoảng 100 byte, 50 dòng khoảng 5 KB, còn rất xa giới hạn 400 KB của một item DynamoDB.

### Gộp giỏ khách khi đăng nhập (cart.md BR-10)

Giỏ của khách vãng lai **không lưu trong bảng này** mà nằm trên trình duyệt; bảng `carts` vẫn chỉ có giỏ của người đã đăng nhập (khoá `userId`). `POST /api/v1/cart/merge` đọc giỏ tài khoản, cộng dồn các món của giỏ khách theo luật BR-03, BR-04, rồi ghi lại cả item bằng **ghi có điều kiện** trên `updatedAt` (hai lần gộp chạy song song thì một lần phải đọc lại và làm lại).

Chống gộp hai lần bằng Powertools Idempotency, khoá `userId#idempotencyKey`, TTL 24 giờ, giống `POST /orders`. Theo luật mỗi module một bảng (ADR-0009), module `cart` có bảng idempotency **riêng** (`cart-idempotency`), không dùng chung bảng của `ordering`.

> ⚠️ **Cần An chốt:** thêm bảng `cart-idempotency` trong CDK, hay cho hai module dùng chung một bảng idempotency với tiền tố khoá (`cart#…`, `order#…`)?

---

## Bảng `orders` (module ordering)

### Truy vấn cần có

| # | Truy vấn | Tần suất |
|---|---|---|
| Q1 | Chi tiết 1 đơn theo `orderId` | Vừa |
| Q2 | Lịch sử đơn của `userId`, mới nhất trước | Vừa |
| Q3 | Admin: tất cả đơn theo `status`, mới nhất trước | Thấp |

### Thiết kế khoá

| Thuộc tính | Kiểu | Giá trị | Phục vụ |
|---|---|---|---|
| **PK** | String | `userId` | Q2 — Query |
| **SK** | String | `orderId` (ULID — tự sắp xếp theo thời gian) | Q2 — sort tự nhiên mới nhất trước |
| **GSI1-PK** | String | `status` | Q3 — Query trên GSI1 |
| **GSI1-SK** | String | `orderId` | Q3 — sort theo thời gian |

> Q1 (chi tiết đơn): nếu biết `userId` thì GetItem. Nếu không biết `userId` (admin dùng orderId thô): dùng GSI2 hoặc lưu thêm GSI2-PK=`orderId`.

**GSI thêm cho admin:**

| GSI | PK | SK | Phục vụ |
|---|---|---|---|
| `byStatus` | `status` | `orderId` | Q3 |
| `byOrderId` | `orderId` | — | Q1 khi chỉ có orderId |

### Schema thuộc tính

```
userId          String   PK
orderId         String   SK (ULID)
status          String   (PENDING | CONFIRMED | SHIPPED | DELIVERED | CANCELLED)
items           List     Snapshot [{productId, name, price, quantity}]
totalAmount     Number   (VND)
shippingFee     Number   (VND, luôn 0 trong MVP)
shippingAddress Map      {fullName, phone, address, province}
paymentMethod   String   (COD)
createdAt       String   (ISO 8601 UTC)
updatedAt       String   (ISO 8601 UTC)
```

### Giao dịch đặt hàng và huỷ đơn (ordering.md BR-08, BR-12)

**Đặt hàng:** một `TransactWriteItems` gồm:

| # | Bảng | Thao tác | Điều kiện |
|---|---|---|---|
| 1..n | `products` | `UpdateItem SET stock = stock - :qty` cho từng món | `stock >= :qty AND status = ACTIVE AND price = :expectedPrice` |
| n+1 | `orders` | `PutItem` đơn mới `PENDING` | `attribute_not_exists(orderId)` |
| n+2 | `carts` | `UpdateItem` bỏ các món đã đặt khỏi `items` | — |

- Một điều kiện sai là cả giao dịch huỷ, không có gì thay đổi. Lỗi `TransactionCanceledException` cho biết món nào sai, để trả 409 `OUT_OF_STOCK` hoặc `PRICE_CHANGED` đúng món.
- Giới hạn 100 thao tác mỗi giao dịch → một đơn tối đa 50 dòng (ordering.md BR-02) là an toàn.

**Huỷ đơn:** một `TransactWriteItems` gồm `UpdateItem` đơn `SET status = CANCELLED` với điều kiện `status IN (...)` được phép (BR-10, BR-11), cộng `UpdateItem` từng sản phẩm `SET stock = stock + :qty`. Điều kiện trạng thái bảo đảm huỷ hai lần chỉ hoàn kho một lần.

> ⚠️ **Cần An chốt:** giao dịch này ghi vào bảng của 3 module (`products` của catalog, `carts` của cart). Điều đó đi ngược luật "module không đụng bảng của nhau" (ADR-0009, ADR-0012). Hai hướng:
> 1. Cho phép ngoại lệ có ghi lại: role IAM của `ordering` chỉ được `UpdateItem` vào thuộc tính `stock` của `products` và `items` của `carts`. Đơn giản, bảo đảm không bán vượt tồn kho.
> 2. Tách bằng sự kiện: `ordering` giữ chỗ tồn kho qua port, `cart` tự xoá món khi nhận sự kiện `OrderPlaced`. Đúng luật hơn nhưng phức tạp hơn nhiều (phải xử lý bù trừ khi một bước lỗi).
>
> Hoàng đề xuất hướng 1 cho 8 tuần.

---

## Bảng `idempotency` (module ordering)

| Thuộc tính | Kiểu | Giá trị |
|---|---|---|
| **PK** | String | `userId#idempotencyKey` |
| `orderId` | String | ID đơn đã tạo |
| `statusCode` | Number | HTTP status của lần tạo đầu |
| `ttl` | Number | Epoch seconds, 24 giờ sau khi tạo |

> Powertools Idempotency quản lý bảng này tự động.

---

## Câu hỏi cần An và Nhân góp ý

1. ~~**`carts`** — giới hạn 400KB~~ — đã giới hạn giỏ tối đa 50 dòng (khoảng 5 KB).
2. **`orders` GSI `byOrderId`** — có cần không hay đủ khi admin luôn biết `userId`?
3. **`products` GSI1-PK = `category#status`** — nếu thêm filter giá sau này thì cần thêm GSI hay dùng filter expression? (Với cache trong Lambda ở Q4, Q5, lọc giá cũng làm được trên mảng trong bộ nhớ.)
4. Bảng `events` (Nhân) — dùng chung hay bảng riêng? Ảnh hưởng tới IAM role của module ordering.
5. **Giao dịch đặt hàng** ghi vào `products` và `carts` — chọn hướng 1 hay 2 (xem mục "Giao dịch đặt hàng và huỷ đơn")?
