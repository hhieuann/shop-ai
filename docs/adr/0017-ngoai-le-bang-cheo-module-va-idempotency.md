# ADR-0017: Ngoại lệ đọc, ghi bảng của module khác; bảng idempotency riêng từng module

- Trạng thái: Chấp nhận
- Ngày: 08/10/2026
- Người quyết: An, theo đề xuất của Hoàng

## Bối cảnh

- ADR-0009 và ADR-0012: mỗi module sở hữu bảng riêng, module không đụng dữ liệu của nhau, cần dữ liệu thì qua port hoặc sự kiện.
- Module `cart` cần tên, ảnh, giá hiện tại, tồn kho, trạng thái của từng món mỗi lần xem giỏ (cart.md BR-06, BR-07). Các thuộc tính này chỉ có trong bảng `products` của `catalog`. Gọi API catalog thì thêm một chặng mạng và gấp đôi số lần chạy Lambda cho mỗi lần xem giỏ.
- Module `ordering` cần trừ tồn kho, tạo đơn và bỏ món khỏi giỏ trong **một** `TransactWriteItems` để không bán vượt tồn kho (dynamodb-design.md, mục giao dịch đặt hàng). Tách bằng sự kiện thì phải tự viết bước bù trừ khi một bước lỗi, không kịp trong 8 tuần.
- `POST /api/v1/cart/merge` và `POST /api/v1/orders` đều cần chống xử lý hai lần bằng `Idempotency-Key`. ADR-0012 mới ghi một bảng `idempotency` của `ordering`.

## Quyết định

**1. Cho phép đúng các ngoại lệ trong bảng dưới, không hơn.** Mỗi ngoại lệ mới phải thêm một dòng vào bảng này qua PR.

| Module | Bảng của module khác | Quyền IAM (chỉ những quyền này) | Dùng cho |
|---|---|---|---|
| `cart` | `products` (catalog) | `dynamodb:BatchGetItem` trên ARN bảng, không gồm index | Xem giỏ, thêm món, gộp giỏ: đọc tên, ảnh, giá, tồn kho, trạng thái |
| `ordering` | `products` (catalog) | `dynamodb:UpdateItem` | Trừ tồn kho khi đặt, cộng lại khi huỷ, trong `TransactWriteItems` |
| `ordering` | `carts` (cart) | `dynamodb:UpdateItem` | Bỏ các món đã đặt khỏi giỏ trong cùng giao dịch |

Không cấp `PutItem`, `DeleteItem`, `BatchWriteItem`, `Scan` trên bảng của module khác. Giới hạn thêm theo thuộc tính (điều kiện `dynamodb:Attributes`) thử trên sandbox khi làm `ordering`; chạy được thì thêm, không được thì giữ mức hành động như bảng trên.

**2. Code vẫn đi qua port.** Luật "module không import module khác" (`.dependency-cruiser.cjs`) giữ nguyên:

- `cart` khai báo port `ProductCatalog` trong `ports.ts`. Phần đọc bảng nằm riêng ở `modules/cart/infra/dynamoProductCatalog.ts`:
  - chỉ lấy thuộc tính cần (`ProjectionExpression`), kiểm bằng zod;
  - gọi lại phần `UnprocessedKeys`;
  - mỗi lần gọi tối đa 50 khoá, đúng giới hạn 50 dòng của giỏ.
- `cart` tự áp luật hiển thị: món `INACTIVE` hoặc không còn trong bảng thì báo không mua được. Không import `domain` của catalog.
- `ordering` làm tương tự: port giữ chỗ tồn kho và port bỏ món khỏi giỏ, phần ghi bảng nằm trong `modules/ordering/infra/`.
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

## Hệ quả

- **Dễ hơn:**
  - xem giỏ nhanh, rẻ;
  - không bán vượt tồn kho nhờ một giao dịch;
  - quyền IAM vẫn hẹp và ghi rõ từng ngoại lệ.
- **Khó hơn:**
  - catalog đổi tên hoặc kiểu của `name`, `imageUrl`, `price`, `stock`, `status` thì phải sửa cả `cart` và `ordering`. PR đổi schema `products` phải nhắc tới ADR này;
  - luật "INACTIVE thì khách không mua được" có ở cả catalog và cart.
- **Cần xem lại khi:**
  - tách module thành service riêng;
  - catalog có cache hoặc nguồn dữ liệu khác DynamoDB;
  - có thêm module muốn đọc bảng của module khác.
