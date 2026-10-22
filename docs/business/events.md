# Sự kiện hành vi (`events`) — cách ghi và dùng

> Bản 0. Dựa theo `docs/team/nhan.md`, ADR-0009 và `contracts/openapi.yaml`
> (đọc ngày 09/10/2026). Module `events` là một trong 6 module của hệ thống
> (`catalog`, `cart`, `ordering`, `recommendation`, `events`, `admin` — ADR-0009),
> mỗi module một Lambda, một bảng DynamoDB riêng, **cấm import code module khác**,
> chỉ nói chuyện qua port hoặc sự kiện SQS.
>
> Cập nhật 22/10/2026: route `POST /api/v1/events` đã có trong contract (#174), code module
> ở `services/api/src/modules/events` (#200), hạ tầng ở `infra/lib/api-stack.ts` (`addEvents`).

## 1. Loại sự kiện

| Loại | Ai tạo | Qua đâu |
|---|---|---|
| `VIEW` | Client (trình duyệt) | API, khi user mở trang sản phẩm |
| `ADD_TO_CART` | Client | API, khi user bấm thêm vào giỏ |
| `PURCHASE` | **Chỉ** module `ordering` | Nội bộ, khi đơn chuyển trạng thái `confirmed` |

**Quy tắc bắt buộc:** API ghi sự kiện công khai **chỉ nhận** `VIEW` và `ADD_TO_CART`.
`PURCHASE` không bao giờ được nhận trực tiếp từ client — nếu client tự gửi `PURCHASE`,
API phải từ chối. Lý do: nếu cho phép, ai cũng tạo được sự kiện mua giả để đẩy sản
phẩm lên gợi ý (xem threat model, mục đầu độc dữ liệu).

**`PURCHASE` được tạo thế nào (nhóm chốt 17/10 và 21/10/2026):** worker `order-processor`
của `ordering`, sau khi chuyển đơn sang `CONFIRMED`, gửi tin vào SNS topic `order-confirmed`
(An dựng). Hàng đợi SQS của `events` (có DLQ) nghe topic này; consumer của `events` ghi mỗi
món trong đơn thành một sự kiện `PURCHASE`. `ordering` không ghi thẳng bảng `events`, đúng
ADR-0009. Nội dung tin: `{ orderId, userId, confirmedAt, items: [{ productId, quantity }] }`,
không có `shippingAddress` (ordering.md, luồng SQS bước 2.3). Consumer dùng `confirmedAt`
làm thời điểm sự kiện, băm `userId` như mục 2, và lưu thêm `orderId`, `quantity` để pipeline
gom món theo đơn cho luật mua kèm. Consumer làm sau khi An dựng topic và hàng đợi.

## 2. Ẩn danh `userId`

- `userId` thật (từ token Cognito) **không bao giờ được lưu** trong bảng `events`.
  Lưu ý: điều này **chỉ áp dụng cho `events`**. Bảng `Order` (theo
  `contracts/openapi.yaml`) có trường `userId` là `userId` thật, không ẩn danh —
  đúng và cần thiết, vì đơn hàng cần biết chính xác ai đặt để giao hàng, huỷ đơn,
  hỗ trợ khách. Hai không gian dữ liệu này tách biệt: `events`/mô hình gợi ý chỉ
  thấy `userIdHash`, còn `ordering` vẫn thấy `userId` thật.
- Trước khi ghi, tính `HMAC(key, userId)` và lưu giá trị băm này làm `userIdHash`.
- Khoá HMAC lưu ở SSM Parameter Store (SecureString), không hardcode trong code.
- Cách băm (HMAC-SHA256, khoá dạng chuỗi UTF-8, đầu ra hex chữ thường 64 ký tự) nằm ở một chỗ:
  `services/api/src/shared/userIdHash.ts`. Module `recommendation` dùng cùng hàm đó để tra
  `FOR_YOU#<userIdHash>`, nên hai bên luôn ra cùng giá trị.
- Hệ quả: nếu cần tra một user cụ thể (ví dụ phục vụ yêu cầu xoá dữ liệu), phải tính
  lại HMAC từ `userId` thật + khoá, chứ không tra ngược được từ `userIdHash`.

## 3. Trường dữ liệu đề xuất

| Trường | Ghi chú |
|---|---|
| `eventId` | Sinh tự động |
| `userIdHash` | HMAC, không phải `userId` thật |
| `itemId` | Sản phẩm liên quan |
| `eventType` | `VIEW` \| `ADD_TO_CART` \| `PURCHASE` |
| `timestamp` | **Do server đặt**, không nhận từ client (tránh client gửi giờ giả) |
| `source` | Tuỳ chọn: web, mobile... |

## 4. Dùng để làm gì

- **Luật mua kèm** (`recommendation.md` mục 2.1): chỉ dùng `PURCHASE` của đơn `confirmed`, nhóm theo `orderId` để biết sản phẩm nào cùng giỏ.
- **Item-based CF** (`recommendation.md` mục 2.2): dùng cả ba loại sự kiện với trọng số khác nhau, làm input cho ma trận tương tác user–item.

## 5. Bảo mật khi ghi sự kiện

- Xác thực bằng token Cognito ở backend; `userId` lấy từ token, không nhận từ body request.
- Rate limit / WAF rule riêng cho route ghi sự kiện, chặn spam (xem threat model).
- Không log `userId` thật hay `userIdHash` kèm thông tin định danh khác (email, IP) trong cùng một dòng log nếu không cần thiết.

## 6. Thật sự chưa biết hoặc chưa trả lời (đã kiểm tra nguồn, không phải đoán)

- [x] Câu hỏi 4 trong `dynamodb-design.md`: bảng `events` riêng; `ordering` báo qua SNS topic `order-confirmed` (chốt 17/10 và 21/10/2026, mục 1).
- [x] Route API cho `VIEW`/`ADD_TO_CART`: nhóm chốt ngày 17/10/2026 là `POST /api/v1/events`, bắt buộc đăng nhập, body `{ productId, eventType }`, trả 202. Xem `recordEvent` trong `contracts/openapi.yaml`.
- [x] Khoá của bảng `events`: `userIdHash` + `eventKey`, TTL 90 ngày (dynamodb-design.md, #200). GSI theo `productId` làm ở tuần 5.
- [ ] Khoá HMAC: có xoay khoá định kỳ không? Không ADR nào nhắc tới — nếu có xoay khoá, cần kế hoạch xử lý dữ liệu cũ.
