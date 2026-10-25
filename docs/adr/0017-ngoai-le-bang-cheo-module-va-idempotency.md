# ADR-0017: Ngoại lệ đọc, ghi bảng của module khác; bảng idempotency riêng từng module

- Trạng thái: Chấp nhận
- Ngày: 08/10/2026 · Sửa: 24/10/2026 (ordering đọc `products`, `carts` và chỉ ghi cột `stock`; `recommendation` đọc `products`; ngoại lệ Scan cho pipeline gợi ý; #226)
- Người quyết: An, theo đề xuất của Hoàng; phần sửa 24/10 An chốt, Nhân góp ý phần `recommendation`

## Bối cảnh

- ADR-0009 và ADR-0012: mỗi module sở hữu bảng riêng, module không đụng dữ liệu của nhau, cần dữ liệu thì qua port hoặc sự kiện.
- Module `cart` cần tên, ảnh, giá hiện tại, tồn kho, trạng thái của từng món mỗi lần xem giỏ (cart.md BR-06, BR-07). Các thuộc tính này chỉ có trong bảng `products` của `catalog`. Gọi API catalog thì thêm một chặng mạng và gấp đôi số lần chạy Lambda cho mỗi lần xem giỏ.
- Module `ordering` cần trừ tồn kho, tạo đơn và bỏ món khỏi giỏ trong **một** `TransactWriteItems` để không bán vượt tồn kho (dynamodb-design.md, mục giao dịch đặt hàng). Tách bằng sự kiện thì phải tự viết bước bù trừ khi một bước lỗi, không kịp trong 8 tuần.
- `POST /api/v1/cart/merge` và `POST /api/v1/orders` đều cần chống xử lý hai lần bằng `Idempotency-Key`. ADR-0012 mới ghi một bảng `idempotency` của `ordering`.
- Bổ sung 24/10/2026:
  - Khi thiết kế chi tiết, `ordering` cần **đọc** trước giao dịch: tên, giá, tồn kho, trạng thái để chụp vào đơn và trả đủ `invalidItems`, `changedItems` (ordering.md BR-03, BR-07); và giỏ hiện tại, vì giỏ là một List có `version` (cart ghi lạc quan), không đọc mà ghi đè thì mất thay đổi giỏ đang chạy song song.
  - API gợi ý cần tồn kho, trạng thái mới nhất để bỏ hàng hết, `INACTIVE` (recommendation.md); pipeline mỗi đêm cần danh sách sản phẩm và loại để tính hàng bán chạy theo loại.
  - Threat model O7: role `ordering` có `UpdateItem` trên `products` thì sửa được cả giá.

## Quyết định

**1. Cho phép đúng các ngoại lệ trong bảng dưới, không hơn.** Mỗi ngoại lệ mới phải thêm một dòng vào bảng này qua PR.

| Module | Bảng của module khác | Quyền IAM (chỉ những quyền này) | Dùng cho |
|---|---|---|---|
| `cart` | `products` (catalog) | `dynamodb:BatchGetItem` trên ARN bảng, không gồm index | Xem giỏ, thêm món, gộp giỏ: đọc tên, ảnh, giá, tồn kho, trạng thái |
| `ordering` | `products` (catalog) | `dynamodb:BatchGetItem` trên ARN bảng, không gồm index, `ProjectionExpression` `productId, name, price, stock, status` | Đọc trước giao dịch đặt hàng: chụp tên, giá vào đơn, kiểm lại từng món (BR-03, BR-07) |
| `ordering` | `products` (catalog) | `dynamodb:UpdateItem`, điều kiện IAM `dynamodb:Attributes` chỉ `productId`, `stock` (threat model O7, #234) | Trừ tồn kho khi đặt, cộng lại khi huỷ, trong `TransactWriteItems` |
| `ordering` | `carts` (cart) | `dynamodb:GetItem` | Đọc giỏ để biết danh sách và `version` hiện tại |
| `ordering` | `carts` (cart) | `dynamodb:UpdateItem`, ghi `SET items, version, updatedAt` với điều kiện `version = :v` | Bỏ các món đã đặt khỏi giỏ trong cùng giao dịch, không đè thay đổi giỏ song song |
| `recommendation` (API) | `products` (catalog) | `dynamodb:BatchGetItem` trên ARN bảng, không gồm index (giống `cart`) | Lấy tồn kho, trạng thái mới nhất để bỏ hàng hết, `INACTIVE` khỏi gợi ý |
| `recommendation` (pipeline mỗi đêm) | `products` (catalog) | `dynamodb:Scan` chỉ đọc, `ProjectionExpression` `productId, category, status, createdAt` | Danh sách sản phẩm và loại cho baseline bán chạy theo loại; chạy nền mỗi đêm, không phục vụ request |
| `recommendation` (pipeline mỗi đêm) | `events` (events) | `dynamodb:Scan` chỉ đọc trên ARN bảng | Đọc sự kiện đã ẩn danh (`userIdHash`, không có `userId` thật) để tính gợi ý và đếm đơn cho hàng bán chạy; chạy nền mỗi đêm, không phục vụ request (thêm 25/10/2026) |

Không cấp `PutItem`, `DeleteItem`, `BatchWriteItem` trên bảng của module khác. Không cấp `Scan` trên bảng của module khác, **trừ** pipeline gợi ý mỗi đêm đọc `products` và `events` như bảng trên (job nền, catalog 104 sản phẩm; luật "không Scan" của API vẫn giữ cho mọi Lambda phục vụ request).

**Giới hạn theo thuộc tính cho `ordering` trên `products` (O7):** điều kiện `dynamodb:Attributes` đã có trong IAM từ #234. Chưa thử được trên sandbox, nên thử trên dev bằng giao dịch đặt hàng thật khi có code `POST /api/v1/orders` (#229), gồm cả điều kiện `stock >= :qty` trong `ConditionExpression`. Chạy được thì giữ; không chạy thì bỏ điều kiện IAM, giữ mức hành động `UpdateItem` như bảng, và ghi kết quả vào đây. Kết quả thử: _chưa có (chờ #229)_.

**2. Code vẫn đi qua port.** Luật "module không import module khác" (`.dependency-cruiser.cjs`) giữ nguyên:

- `cart` khai báo port `ProductCatalog` trong `ports.ts`. Phần đọc bảng nằm riêng ở `modules/cart/infra/dynamoProductCatalog.ts`:
  - chỉ lấy thuộc tính cần (`ProjectionExpression`), kiểm bằng zod;
  - gọi lại phần `UnprocessedKeys`;
  - mỗi lần gọi tối đa 50 khoá, đúng giới hạn 50 dòng của giỏ.
- `cart` tự áp luật hiển thị: món `INACTIVE` hoặc không còn trong bảng thì báo không mua được. Không import `domain` của catalog.
- `ordering` làm tương tự: port đọc sản phẩm, port đọc giỏ, và giao dịch trừ kho, bỏ món khỏi giỏ nằm trong `modules/ordering/infra/`. Ordering ghi bảng `carts` theo đúng schema của cart (`items`, `version` UUID, `updatedAt`).
- `recommendation` cũng khai báo port `ProductCatalog` riêng (#224); adapter đọc bảng nằm trong `modules/recommendation/infra/`. Pipeline Python đọc `products` trong `data/`, không qua code TypeScript của catalog.
- Sau này muốn tách hẳn (gọi API catalog hoặc dùng sự kiện) thì chỉ thay file trong `infra/` của module đó.

**3. Mỗi module cần idempotency có bảng riêng:** `cart-idempotency`, `order-idempotency`. Bảng `idempotency` trong ADR-0012 đổi tên thành `order-idempotency`.

- Schema theo Powertools for AWS Lambda (Idempotency): khoá chính `id` (String), TTL trên thuộc tính `expiration`, on-demand.
- Lambda của module chỉ có quyền trên bảng idempotency của chính nó.
- Cấu hình chung đặt ở `services/api/src/shared/idempotency`:
  - TTL 24 giờ;
  - khoá gồm `userId` và header `Idempotency-Key`;
  - thiếu header thì trả 400;
  - cùng khoá nhưng nội dung khác thì trả 422 `IDEMPOTENCY_KEY_REUSED` theo RFC 9457.
  Module chỉ truyền tên bảng.

## Các lựa chọn đã cân nhắc

| Lựa chọn | Độ phức tạp | Chi phí | Hợp với nhóm |
|---|---|---|---|
| **Cart đọc thẳng `products` qua port, chỉ `BatchGetItem` (chọn)** | Thấp | 1 lần đọc DynamoDB mỗi lần xem giỏ | Có |
| Cart gọi API catalog | Vừa | Gấp đôi số lần chạy Lambda, thêm độ trễ | Không đáng ở quy mô này |
| Cart chép giá, tồn kho vào bảng `carts` lúc thêm | Thấp | Thấp | Không: giá, tồn kho cũ, sai BR-06, BR-07 |
| **Ordering ghi bảng khác trong một giao dịch (chọn, hướng 1)** | Thấp | 1 giao dịch mỗi đơn | Có |
| Ordering tách bằng sự kiện, có bù trừ (hướng 2) | Cao | Thêm SQS hoặc EventBridge | Không kịp 8 tuần |
| **Bảng idempotency riêng từng module (chọn)** | Thấp | Bảng on-demand không dùng thì không tốn tiền | Có, đúng ADR-0012 |
| Một bảng idempotency chung, phân biệt bằng tiền tố khoá | Thấp | Như trên | Không: role `cart` ghi được khoá của `ordering` |
| **Ordering đọc `products`, `carts` trước giao dịch (chọn, 24/10)** | Thấp | Thêm 2 lần đọc mỗi đơn | Có |
| Lấy tên, giá từ client | Thấp | 0 | Không: không tin dữ liệu client (threat model B1, O1) |
| Không bỏ món khỏi giỏ trong giao dịch, cart tự dọn qua sự kiện | Vừa | Thêm hàng đợi cho cart | Không: sai ordering.md BR-08, BR-09 |
| **Pipeline gợi ý Scan `products` chỉ đọc (chọn, 24/10)** | Thấp | Đọc 104 sản phẩm mỗi đêm | Có |
| Pipeline đọc `products` qua API catalog | Vừa | Phân trang 50 mỗi lần, thêm lời gọi Lambda | Không đáng với job chạy nền mỗi đêm |

## Hệ quả

- **Dễ hơn:**
  - xem giỏ nhanh, rẻ;
  - không bán vượt tồn kho nhờ một giao dịch;
  - quyền IAM vẫn hẹp và ghi rõ từng ngoại lệ.
- **Khó hơn:**
  - catalog đổi tên hoặc kiểu của `name`, `imageUrl`, `price`, `stock`, `status`, `category`, `createdAt` thì phải sửa cả `cart`, `ordering`, `recommendation` và pipeline gợi ý. PR đổi schema `products` phải nhắc tới ADR này; cart đổi schema `carts` thì phải sửa cả `ordering`;
  - luật "INACTIVE thì khách không mua được" có ở cả catalog và cart.
- **Cần xem lại khi:**
  - tách module thành service riêng;
  - catalog có cache hoặc nguồn dữ liệu khác DynamoDB;
  - có thêm module muốn đọc bảng của module khác.
