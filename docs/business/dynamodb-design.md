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
version    String   (UUID, đổi mỗi lần ghi; dùng cho ghi có điều kiện)
updatedAt  String   (ISO 8601 UTC)
```

> `addedPrice` — giá lúc thêm hoặc sửa số lượng gần nhất; khác giá hiện tại thì bật cờ `priceChanged` (cart.md BR-06).
>
> Ghi có điều kiện (`modules/cart/infra/dynamoCartRepository.ts`): mọi thao tác thêm, sửa, xoá đọc giỏ (`ConsistentRead`), áp luật, rồi `PutItem` với điều kiện `version` chưa đổi (giỏ mới: `attribute_not_exists(userId)`). Có request khác ghi trước thì đọc lại và làm lại, tối đa 3 lần. Dùng `version` ngẫu nhiên thay vì `updatedAt` để hai lần ghi trong cùng một mili giây không bị coi là cùng phiên bản.
>
> Giới hạn 50 dòng (cart.md BR-02): mỗi dòng khoảng 100 byte, 50 dòng khoảng 5 KB, còn rất xa giới hạn 400 KB của một item DynamoDB.

### Gộp giỏ khách khi đăng nhập (cart.md BR-10)

Giỏ của khách vãng lai **không lưu trong bảng này** mà nằm trên trình duyệt; bảng `carts` vẫn chỉ có giỏ của người đã đăng nhập (khoá `userId`). `POST /api/v1/cart/merge` đọc giỏ tài khoản, cộng dồn các món của giỏ khách theo luật BR-03, BR-04, rồi ghi lại cả item bằng **ghi có điều kiện** trên `updatedAt` (hai lần gộp chạy song song thì một lần phải đọc lại và làm lại).

Chống gộp hai lần bằng Powertools Idempotency, khoá `userId#idempotencyKey`, TTL 24 giờ, giống `POST /orders`. Theo luật mỗi module một bảng (ADR-0009), module `cart` có bảng idempotency **riêng** (`cart-idempotency`), không dùng chung bảng của `ordering`.

> ✅ **Đã chốt 08/10 ([ADR-0017](../adr/0017-ngoai-le-bang-cheo-module-va-idempotency.md)):** bảng `cart-idempotency` riêng (khoá `id`, TTL `expiration` theo Powertools); `ordering` dùng `order-idempotency`. Cấu hình chung ở `shared/idempotency`.

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

> ✅ **Đã chốt 08/10 ([ADR-0017](../adr/0017-ngoai-le-bang-cheo-module-va-idempotency.md)): hướng 1.** Role của `ordering` chỉ có `dynamodb:UpdateItem` trên `products` và `carts`, không `PutItem` hay `DeleteItem`; phần ghi nằm trong `modules/ordering/infra/` sau port. `cart` đọc `products` chỉ bằng `BatchGetItem`.

---
## Bảng `events` (module events)

Người viết: Nhân · Ngày: 09/10/2026 — **đề xuất, chưa chốt**, cần An/Hoàng góp ý.

### Truy vấn cần có

| # | Truy vấn | Tần suất |
|---|---|---|
| Q1 | Ghi 1 sự kiện (`VIEW`/`ADD_TO_CART` từ API; `PURCHASE` từ luồng đơn `CONFIRMED`, xem mục "Câu hỏi 4" cuối file) | Cao |
| Q2 | Job đêm đọc **toàn bộ** sự kiện trong một khoảng thời gian, để tính luật mua kèm và item-based CF | 1 lần/đêm, nhưng đọc hết bảng |
| Q3 | (tuỳ chọn) Đếm nhanh lượt xem/mua gần đây của 1 sản phẩm — phục vụ phát hiện đầu độc gợi ý (tuần 5) | Thấp |

### Thiết kế khoá

| Thuộc tính | Kiểu | Giá trị | Phục vụ |
|---|---|---|---|
| **PK** | String | `userIdHash` | Q1 — PutItem |
| **SK** | String | `<timestamp ISO 8601>#<eventId>` | Sắp theo thời gian tự nhiên |
| **GSI1-PK** | String | `itemId` | Q3 — Query trên GSI1 |
| **GSI1-SK** | String | `timestamp` | Q3 — mới nhất trước |

### Schema thuộc tính

```
userIdHash   String   PK   (HMAC, không phải userId thật)
timestamp    String   SK component (ISO 8601 UTC, do server đặt)
eventId      String   SK component (ULID)
itemId       String
eventType    String   (VIEW | ADD_TO_CART | PURCHASE)
```

### Vấn đề cần quyết định: Q2 có được Scan không?

Quy tắc "không Scan ở bất kỳ đâu" trong `catalog.md` áp dụng cho Lambda **phục vụ
request của người dùng** — chưa rõ có áp dụng cho job phân tích chạy nền mỗi đêm hay
không, vì bản chất khác nhau (một cái phải nhanh theo từng click, một cái chỉ cần
xong trong 15 phút của Lambda). Hai hướng:

| Hướng | Cách làm | Đánh đổi |
|---|---|---|
| **A. Scan trực tiếp bảng `events`** | Job đêm Scan toàn bộ, lọc theo thời gian | Đơn giản, nhưng tốn RCU của bảng đang phục vụ ghi sự kiện thật, tăng độ trễ ghi lúc job chạy |
| **B. DynamoDB Streams → Firehose/S3** | Mọi sự kiện ghi xong tự động chảy sang S3 (qua Streams), job đêm đọc file trên S3 | Tách biệt khỏi traffic ghi thật, nhưng thêm một thành phần hạ tầng cần An dựng |

**Đề xuất của mình: hướng A trước (đơn giản, kịp 8 tuần), vì quy mô demo (vài trăm
sản phẩm, vài trăm nghìn sự kiện theo `demo-scale.md`) nhỏ.** Chuyển sang B nếu
Scan làm chậm ghi sự kiện thật rõ rệt khi đo thử. *(Mình chưa đọc `demo-scale.md`
nên con số quy mô ở đây là suy đoán — cần kiểm tra lại.)*

---

## Bảng `recs` (module recommendation)

Người viết: Nhân · Ngày: 09/10/2026 — **đề xuất, chưa chốt**, cần An/Hoàng góp ý.

### Truy vấn cần có

| # | Truy vấn | Tần suất |
|---|---|---|
| Q1 | API đọc top 10 gợi ý **đang ACTIVE** cho 1 `anchorId` (`userIdHash` hoặc `itemId`) | Cao |
| Q2 | Job đêm ghi 1 version mới (10 dòng cho mỗi anchor) | 1 lần/đêm, ghi nhiều dòng |
| Q3 | Job đêm đọc version đang ACTIVE để so chỉ số trước khi quyết định chuyển cờ | 1 lần/đêm |

### Thiết kế khoá

Mỗi anchor có **một item con trỏ** (lưu version nào đang ACTIVE) và **nhiều item
dòng gợi ý** (mỗi version 10 dòng), cùng PK, phân biệt bằng SK:

| Thuộc tính | Kiểu | Giá trị | Phục vụ |
|---|---|---|---|
| **PK** | String | `<recType>#<anchorId>`, ví dụ `FOR_YOU#u0a1b2c` hoặc `ALSO_BOUGHT#gpu-001` | |
| **SK** | String | `ACTIVE` (item con trỏ) hoặc `<version>#<rank>` (item dòng gợi ý) | |

**Cách đọc (Q1):** 2 lần đọc — `GetItem(PK, SK="ACTIVE")` lấy `activeVersion`, rồi
`Query(PK, SK begins_with "<activeVersion>#")` lấy đúng 10 dòng. Rõ ràng, không cần
GSI, nhưng tốn 2 round-trip. *(Có thể gộp còn 1 lần đọc nếu chấp nhận ghi lặp dữ
liệu — chưa quyết, cần bàn thêm nếu độ trễ API là vấn đề.)*

### Schema thuộc tính

```
# Item con trỏ (1 cái mỗi anchor)
pk              String   PK   (<recType>#<anchorId>)
sk              String   SK   ("ACTIVE")
activeVersion   Number
updatedAt       String   (ISO 8601 UTC)

# Item dòng gợi ý (10 cái mỗi version mỗi anchor)
pk              String   PK   (<recType>#<anchorId>)
sk              String   SK   (<version>#<rank>, ví dụ "7#1")
itemId          String
score           Number
source          String   (ASSOCIATION_RULE | ITEM_CF | BESTSELLER)
generatedAt     String   (ISO 8601 UTC)
```

### Dọn version cũ

Theo ADR-0016, version kém hơn baseline thì không kích hoạt nhưng vẫn giữ lại để
rollback thủ công. **Đề xuất: giữ 3 version gần nhất mỗi anchor, version cũ hơn xoá
bằng TTL** (ví dụ 7 ngày sau khi bị thay bởi version mới) — số 3 và số 7 ngày là số
mình tự chọn, chưa có cơ sở, cần góp ý.

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
4. ~~Bảng `events` (Nhân) — dùng chung hay bảng riêng?~~ **Đã trả lời 09/10:** bảng riêng (`events`, tên đã chốt sẵn ở ADR-0012). Về cách `ordering` báo cho `events` khi đơn `CONFIRMED`: đề xuất `order-processor` bắn thêm một bản tin SNS sau bước ghi `CONFIRMED` thành công (tận dụng topic SNS đang có sẵn để báo admin, thêm `events` làm subscriber thứ hai, hoặc tách topic riêng nếu An thấy hợp lý hơn). Lambda `events` subscribe topic này, ghi `PURCHASE` vào bảng `events`. **Chưa kiểm tra hướng này có khớp với cách Hoàng đã dựng SNS/SQS thật hay không** — cần xác nhận trước khi code. (Chi tiết: `docs/business/events.md`.)
5. **Giao dịch đặt hàng** ghi vào `products` và `carts` — chọn hướng 1 hay 2 (xem mục "Giao dịch đặt hàng và huỷ đơn")?
