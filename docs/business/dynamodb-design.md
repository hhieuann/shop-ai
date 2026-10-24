# Thiết kế bảng DynamoDB

Người viết: Hoàng · Ngày: 01/10/2026 · Sửa: 03/10/2026 (tìm kiếm, giao dịch đặt hàng, huỷ đơn); 21/10/2026 (item bộ đếm `#OPEN`, bảng `order-idempotency` theo ADR-0017, tin `order-confirmed`); 24/10/2026 (đọc trước giao dịch, ghi giỏ có điều kiện `version`, item đánh dấu `#KEY#`, giao dịch n + 4)

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

### Item bộ đếm đơn đang mở (ordering.md BR-14)

Mỗi tài khoản có thêm **một item** trong bảng `orders`, cùng PK với đơn của người đó:

```
userId          String   PK
orderId         String   SK, cố định "#OPEN"
openOrders      Number   số đơn PENDING + CONFIRMED, 0..3
```

- `#` đứng trước mọi chữ số trong thứ tự chuỗi, còn ULID luôn bắt đầu bằng chữ số, nên Q2 (lịch sử đơn) dùng điều kiện khoá `userId = :u AND orderId >= "0"` để không lấy item bộ đếm.
- Item này không có `status` nên không vào GSI `byStatus`. Nếu giữ GSI `byOrderId` thì mọi item bộ đếm cùng nằm dưới khoá `#OPEN` của GSI đó; truy vấn admin theo `orderId` thật không bị ảnh hưởng.
- Không cần bảng mới, không cần đổi hạ tầng; role `ordering` vốn có quyền ghi bảng `orders`.

### Item đánh dấu chống tạo đơn trùng (ordering.md BR-04)

`makeIdempotentUseCase` (shared/idempotency.ts) xoá bản ghi Powertools khi use case ném lỗi; Lambda timeout thì bản ghi đang xử lý tự hết hạn. Nếu giao dịch đặt hàng **đã ghi xong** rồi mới lỗi, gửi lại cùng `Idempotency-Key` sẽ tạo đơn thứ hai và trừ kho lần hai. Vì vậy giao dịch ghi thêm một item đánh dấu, cùng PK với đơn:

```
userId          String   PK
orderId         String   SK, "#KEY#<idempotencyKey>"
refOrderId      String   orderId của đơn đã tạo
payloadHash     String   băm nội dung request (món, số lượng, giá, địa chỉ)
expiresAt       Number   epoch giây, 24 giờ sau khi tạo; bảng orders bật TTL trên thuộc tính này
```

- `#` (0x23) đứng trước `0`, nên lịch sử đơn (`orderId >= "0"`) không lấy item này; không có `status` nên không vào GSI `byStatus`.
- Chỉ item đánh dấu có `expiresAt`, nên TTL không bao giờ xoá đơn thật hay item `#OPEN`.

### Giao dịch đặt hàng và huỷ đơn (ordering.md BR-08, BR-12)

**Trước giao dịch** (quyền đọc theo ADR-0017, sửa 24/10):

1. `BatchGetItem` bảng `products` (`productId, name, price, stock, status`) → domain kiểm từng món (`checkItems`); có lỗi thì trả 409, không ghi gì.
2. `GetItem` bảng `carts` → danh sách còn lại = giỏ bỏ các dòng có `productId` đã đặt (bỏ cả dòng, BR-09), cùng `version` hiện tại.

**Đặt hàng:** một `TransactWriteItems` gồm:

| # | Bảng | Thao tác | Điều kiện |
|---|---|---|---|
| 1..n | `products` | `UpdateItem SET stock = stock - :qty` cho từng món | `stock >= :qty AND status = ACTIVE AND price = :expectedPrice`, `ReturnValuesOnConditionCheckFailure: ALL_OLD` |
| n+1 | `orders` | `PutItem` đơn mới `PENDING` | `attribute_not_exists(orderId)` |
| n+2 | `carts` | `UpdateItem SET items = :conLai, version = :moi, updatedAt = :now` (bỏ thao tác này khi người dùng chưa có giỏ) | `version = :v` |
| n+3 | `orders` | `UpdateItem` item `#OPEN`: `SET openOrders = if_not_exists(openOrders, 0) + 1` | `attribute_not_exists(openOrders) OR openOrders < 3` (BR-14) |
| n+4 | `orders` | `PutItem` item đánh dấu `#KEY#<idempotencyKey>` | `attribute_not_exists(orderId)`, `ReturnValuesOnConditionCheckFailure: ALL_OLD` |

- Một điều kiện sai là cả giao dịch huỷ, không có gì thay đổi. `TransactionCanceledException` cho biết thao tác nào sai; xét theo thứ tự:
  1. **n+4 sai:** đã có đơn cho khoá này. Cùng `payloadHash` → đọc đơn `refOrderId`, trả 200 và gửi lại message SQS (worker chống trùng theo `orderId`). Khác `payloadHash` → 422 `IDEMPOTENCY_KEY_REUSED`. Bỏ qua mọi lý do khác của cùng lần thử: chúng sai chính vì đơn cũ đã trừ kho, tăng bộ đếm.
  2. **n+2 sai:** giỏ vừa đổi `version` → đọc lại giỏ, thử lại, tối đa 3 lần (như cart).
  3. **1..n sai:** dựa vào `ALL_OLD` của món đó trả 409 `OUT_OF_STOCK` hoặc `PRICE_CHANGED` (có người mua hoặc đổi giá giữa bước đọc và giao dịch).
  4. **n+3 sai:** 409 `TOO_MANY_OPEN_ORDERS`.
- Giới hạn 100 thao tác mỗi giao dịch → một đơn tối đa 50 dòng (ordering.md BR-02) cộng 4 thao tác, tối đa 54, là an toàn.
- IAM giới hạn `UpdateItem` trên `products` chỉ cột `stock` (O7, ADR-0017). Nếu thử trên dev thấy điều kiện `status`, `price` hoặc `ALL_OLD` bị chặn thì làm theo ADR-0017 (bỏ điều kiện IAM), không bỏ điều kiện của giao dịch.

**Huỷ đơn:** một `TransactWriteItems` gồm `UpdateItem` đơn `SET status = CANCELLED` với điều kiện `status IN (...)` được phép (BR-10, BR-11), cộng `UpdateItem` từng sản phẩm `SET stock = stock + :qty`. Điều kiện trạng thái bảo đảm huỷ hai lần chỉ hoàn kho một lần. Huỷ đơn `PENDING` hoặc `CONFIRMED` thêm `UpdateItem` item `#OPEN`: `SET openOrders = openOrders - 1` với điều kiện `openOrders > 0`.

**Chuyển `SHIPPED`:** một `TransactWriteItems` gồm `UpdateItem` đơn `SET status = SHIPPED` (điều kiện `status = CONFIRMED`) và `UpdateItem` item `#OPEN` giảm 1 như trên.

> ✅ **Đã chốt 08/10, sửa 24/10 ([ADR-0017](../adr/0017-ngoai-le-bang-cheo-module-va-idempotency.md)): hướng 1.** Role của `ordering` trên `products`: `BatchGetItem` và `UpdateItem` chỉ cột `stock`; trên `carts`: `GetItem` và `UpdateItem`; không `PutItem` hay `DeleteItem`. Phần đọc, ghi nằm trong `modules/ordering/infra/` sau port. `cart` đọc `products` chỉ bằng `BatchGetItem`.

---
## Bảng `events` (module events)

Người viết: Nhân · Ngày: 09/10/2026 · Sửa 22/10/2026: khoá và thuộc tính theo code `modules/events`; GSI1 để sau.

### Truy vấn cần có

| # | Truy vấn | Tần suất |
|---|---|---|
| Q1 | Ghi 1 sự kiện (`VIEW`/`ADD_TO_CART` từ API; `PURCHASE` từ luồng đơn `CONFIRMED`, xem mục "Câu hỏi 4" cuối file) | Cao |
| Q2 | Job đêm đọc **toàn bộ** sự kiện trong một khoảng thời gian, để tính luật mua kèm và item-based CF | 1 lần/đêm, nhưng đọc hết bảng |
| Q3 | (tuỳ chọn) Đếm nhanh lượt xem/mua gần đây của 1 sản phẩm — phục vụ phát hiện đầu độc gợi ý (tuần 5) | Thấp |

### Thiết kế khoá

| Thuộc tính | Kiểu | Giá trị | Phục vụ |
|---|---|---|---|
| **PK** | String | `userIdHash` | Q1 — PutItem có điều kiện `attribute_not_exists(eventKey)`, không ghi đè |
| **SK** `eventKey` | String | `<timestamp ISO 8601>#<eventId>` | Sự kiện của một người sắp theo thời gian |
| **TTL** | Number | `ttl` = thời điểm sự kiện + 90 ngày, giây kể từ 1970 | Tự xoá dữ liệu cũ, khớp luật xoá 90 ngày của bucket dữ liệu (góp ý ở #179) |

GSI1 cho Q3 (`productId` + `timestamp`) chưa tạo; thêm khi làm phát hiện đầu độc gợi ý ở tuần 5.

### Schema thuộc tính

```
userIdHash   String   PK   (HMAC-SHA256 hex của Cognito sub, không phải userId thật)
eventKey     String   SK   (<timestamp>#<eventId>)
timestamp    String   ISO 8601 UTC, do server đặt
eventId      String   ULID (CONTRIBUTING.md, chuẩn code)
productId    String   cùng tên với API (contracts/openapi.yaml)
eventType    String   VIEW | ADD_TO_CART | PURCHASE
ttl          Number   giây kể từ 1970, DynamoDB TTL xoá sau 90 ngày
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

Người viết: Nhân · Ngày: 09/10/2026 · Sửa 14/10 theo đề xuất của An: con trỏ ACTIVE
chung cho cả bảng thay vì mỗi anchor một con trỏ.

### Truy vấn cần có

| # | Truy vấn | Tần suất |
|---|---|---|
| Q1 | API đọc top 10 gợi ý **đang ACTIVE** cho 1 `anchorId` | Cao |
| Q2 | Job đêm ghi 1 version mới (10 dòng cho mỗi anchor) | 1 lần/đêm, ghi nhiều dòng |
| Q3 | Job đêm so chỉ số version mới với baseline, rồi quyết định có chuyển con trỏ không | 1 lần/đêm |

### Thiết kế khoá

**Một con trỏ chung cho mỗi loại gợi ý** (không phải mỗi anchor một con trỏ):

| Thuộc tính | Kiểu | Giá trị | Phục vụ |
|---|---|---|---|
| **pk** (con trỏ) | String | `META` | |
| **sk** (con trỏ) | String | `ACTIVE#FOR_YOU` hoặc `ACTIVE#ALSO_BOUGHT` (hai job riêng, hai con trỏ riêng) | |
| **pk** (dòng gợi ý) | String | `<recType>#<anchorId>`, ví dụ `FOR_YOU#u0a1b2c` | |
| **sk** (dòng gợi ý) | String | `<version>#<rank>`, `rank` đệm 2 chữ số (`01`–`10`) để sắp đúng thứ tự chuỗi | |

**Cách đọc (Q1):** `GetItem(pk="META", sk="ACTIVE#<recType>")` lấy `activeVersion`
(API cache giá trị này trong Lambda 60 giây, cùng cách `catalog.md` đang làm với
danh sách sản phẩm — nên mỗi request gần như chỉ còn 1 Query), rồi
`Query(pk="<recType>#<anchorId>", sk begins_with "<activeVersion>#")` lấy 10 dòng.

**Anchor không có trong version mới** (user hoặc sản phẩm mới, cold-start): Query
không ra dòng nào, API trả về baseline hàng bán chạy theo loại, đúng ADR-0016.

**Bật hoặc rollback một version:** chỉ ghi đè **1 item** (con trỏ `META`), áp dụng
cho mọi anchor cùng lúc — không còn rủi ro job đứt giữa chừng làm web trộn 2
version.

### Schema thuộc tính

```
# Item con trỏ (2 cái, một cho mỗi recType)
pk              String   PK   ("META")
sk              String   SK   ("ACTIVE#FOR_YOU" hoặc "ACTIVE#ALSO_BOUGHT")
activeVersion   Number
updatedAt       String   (ISO 8601 UTC)

# Item dòng gợi ý (10 cái mỗi version mỗi anchor)
pk              String   PK   (<recType>#<anchorId>)
sk              String   SK   (<version>#<rank>, rank đệm 2 chữ số, ví dụ "7#01")
itemId          String
score           Number
source          String   (ASSOCIATION_RULE | ITEM_CF | BESTSELLER)
generatedAt     String   (ISO 8601 UTC)
ttl             Number   (Unix epoch giây; DynamoDB TTL bắt buộc kiểu Number, không dùng được generatedAt dạng chuỗi)
```

### Dọn version cũ

- Mỗi dòng gợi ý ghi `ttl` = thời điểm ghi + 7 ngày. Version cũ tự bị DynamoDB xoá sau
  khoảng 7 ngày, đủ để rollback về version trước trong vòng một tuần.
- **Version đang ACTIVE không được hết hạn:** đêm nào job giữ nguyên con trỏ (version
  mới không đạt baseline), job gia hạn `ttl` của các dòng thuộc version đang ACTIVE
  thêm 7 ngày. Việc này chỉ xảy ra khi version mới bị loại.
- Item con trỏ không có `ttl`.

---

## Bảng `order-idempotency` (module ordering)

Theo [ADR-0017](../adr/0017-ngoai-le-bang-cheo-module-va-idempotency.md) mục 3: mỗi module cần idempotency có bảng riêng; `ordering` dùng `order-idempotency`, cùng schema với `cart-idempotency`. Cấu hình chung ở `services/api/src/shared/idempotency` (TTL 24 giờ, khoá gồm `userId` và header `Idempotency-Key`); module chỉ truyền tên bảng.

| Thuộc tính | Kiểu | Giá trị |
|---|---|---|
| **PK** `id` | String | Powertools tạo từ `userId` và `Idempotency-Key` |
| `expiration` | Number | Epoch giây, 24 giờ sau lần ghi đầu; TTL của bảng đặt trên thuộc tính này |
| `status`, `data`, `in_progress_expiration`, `validation` | | Powertools tự ghi: trạng thái xử lý, kết quả đã lưu (trả lại khi gọi lại cùng khoá), hạn của lần đang xử lý, mã băm nội dung request (khác nội dung → 422 `IDEMPOTENCY_KEY_REUSED`) |

> Powertools Idempotency quản lý bảng này tự động; code không đọc, ghi trực tiếp. On-demand. Lambda `ordering` chỉ có quyền trên bảng này, không có quyền trên `cart-idempotency`.
>
> Worker `order-processor` cũng dùng Powertools Idempotency với khoá `orderId` cho bước gửi email và gửi tin `order-confirmed` (ordering.md, luồng SQS bước 2.2, 2.3). Bảng cho worker chốt khi code worker.

---

## Câu hỏi cần An và Nhân góp ý

1. ~~**`carts`** — giới hạn 400KB~~ — đã giới hạn giỏ tối đa 50 dòng (khoảng 5 KB).
2. **`orders` GSI `byOrderId`** — có cần không hay đủ khi admin luôn biết `userId`?
3. **`products` GSI1-PK = `category#status`** — nếu thêm filter giá sau này thì cần thêm GSI hay dùng filter expression? (Với cache trong Lambda ở Q4, Q5, lọc giá cũng làm được trên mảng trong bộ nhớ.)
4. ~~Bảng `events` (Nhân) — dùng chung hay bảng riêng?~~ **Đã trả lời 09/10:** bảng riêng (`events`, tên đã chốt sẵn ở ADR-0012). Về cách `ordering` báo cho `events` khi đơn `CONFIRMED`: đề xuất `order-processor` bắn thêm một bản tin SNS sau bước ghi `CONFIRMED` thành công (tận dụng topic SNS đang có sẵn để báo admin, thêm `events` làm subscriber thứ hai, hoặc tách topic riêng nếu An thấy hợp lý hơn). Lambda `events` subscribe topic này, ghi `PURCHASE` vào bảng `events`. **Đã chốt 17/10 và 21/10/2026:** `order-processor` gửi tin vào SNS topic `order-confirmed` (An dựng, #211); chỉ SQS của `events` (có DLQ) nghe, không có email admin (chốt 24/10); `ordering` không ghi thẳng bảng `events`. Nội dung tin và cách chống gửi trùng: ordering.md, luồng SQS bước 2.3. (Chi tiết phía `events`: `docs/business/events.md`.)
5. ~~**Giao dịch đặt hàng** ghi vào `products` và `carts` — chọn hướng 1 hay 2?~~ **Đã chốt 08/10 (ADR-0017): hướng 1**, xem mục "Giao dịch đặt hàng và huỷ đơn".
