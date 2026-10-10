# Sự kiện hành vi (`events`) — cách ghi và dùng

> Bản 0. Dựa theo `docs/team/nhan.md`, ADR-0009 và `contracts/openapi.yaml`
> (đọc ngày 09/10/2026). Module `events` là một trong 6 module của hệ thống
> (`catalog`, `cart`, `ordering`, `recommendation`, `events`, `admin` — ADR-0009),
> mỗi module một Lambda, một bảng DynamoDB riêng, **cấm import code module khác**,
> chỉ nói chuyện qua port hoặc sự kiện SQS.
>
> **Route `/events` chưa tồn tại trong `contracts/openapi.yaml` tại thời điểm viết
> tài liệu này** — đã kiểm tra trực tiếp, không phải suy đoán. Cần thêm vào contract
> trước khi có code thật.

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

**`PURCHASE` được tạo thế nào — đây là câu hỏi mở, chưa có đáp án, đang hỏi thẳng mình.**
`docs/business/ordering.md` (Hoàng) mô tả luồng bất đồng bộ hiện tại: API tạo đơn
`PENDING` → đẩy message `{orderId, userId, correlationId}` vào SQS → worker
`order-processor` chuyển `PENDING → CONFIRMED` (ghi có điều kiện), gửi email qua SES,
báo admin qua SNS. **Luồng này hiện không hề gọi tới module `events`.**

`docs/business/dynamodb-design.md` có mục "Câu hỏi cần An và Nhân góp ý", câu 4 ghi
nguyên văn: *"Bảng `events` (Nhân) — dùng chung hay bảng riêng? Ảnh hưởng tới IAM role
của module ordering."* — câu này hỏi trực tiếp mình, **chưa trả lời**.

**Đề xuất (của mình, chưa chốt, cần mang ra hỏi An/Hoàng):** `order-processor` sau khi
ghi `CONFIRMED` thành công thì bắn thêm một bản tin — tận dụng đúng cơ chế SNS đang có
sẵn (worker đã gửi SNS báo admin ở cùng bước), thêm `events` làm một subscriber thứ hai
của cùng topic hoặc một topic riêng. Lý do chọn hướng này thay vì gọi hàm trực tiếp:
đúng tinh thần ADR-0009 (module không import lẫn nhau), và tái dùng hạ tầng nhắn tin đã
có thay vì thêm cơ chế mới. **Chưa kiểm tra hướng này có khớp với cách Hoàng đã dựng
SNS/SQS thật hay không** — cần hỏi trước khi code.

## 2. Ẩn danh `userId`

- `userId` thật (từ token Cognito) **không bao giờ được lưu** trong bảng `events`.
  Lưu ý: điều này **chỉ áp dụng cho `events`**. Bảng `Order` (theo
  `contracts/openapi.yaml`) có trường `userId` là `userId` thật, không ẩn danh —
  đúng và cần thiết, vì đơn hàng cần biết chính xác ai đặt để giao hàng, huỷ đơn,
  hỗ trợ khách. Hai không gian dữ liệu này tách biệt: `events`/mô hình gợi ý chỉ
  thấy `userIdHash`, còn `ordering` vẫn thấy `userId` thật.
- Trước khi ghi, tính `HMAC(key, userId)` và lưu giá trị băm này làm `userIdHash`.
- Khoá HMAC lưu ở SSM Parameter Store (SecureString), không hardcode trong code.
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

- [ ] **Câu hỏi 4 trong `dynamodb-design.md` đang chờ mình trả lời:** `events` dùng chung hay bảng riêng? (Tên bảng `events` đã chốt sẵn trong ADR-0012 — câu hỏi ở đây là về IAM/kết nối với `ordering`, không phải về tên bảng.) Mục trên là đề xuất của mình, cần mang ra bàn với An/Hoàng, không tự quyết một mình vì ảnh hưởng tới IAM role của `ordering`.
- [ ] Route API cụ thể cho `VIEW`/`ADD_TO_CART` (đường dẫn, format request/response) — **đã kiểm tra `contracts/openapi.yaml` ngày 09/10/2026 (bản mới nhất, sau khi `git pull`), chưa có**. Cần thêm vào contract, nhiều khả năng do mình đề xuất vì là chủ module `events`.
- [ ] Khoá chính/GSI của bảng `events` trên DynamoDB — ADR-0012 ghi "bảng chi tiết sẽ chốt khi có nghiệp vụ", tức **xác nhận chưa ai thiết kế**, không phải mình bỏ sót.
- [ ] Khoá HMAC: có xoay khoá định kỳ không? Không ADR nào nhắc tới — nếu có xoay khoá, cần kế hoạch xử lý dữ liệu cũ.
