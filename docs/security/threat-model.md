# Threat model bản 0 (STRIDE)

Người viết: Nhân · Ngày: 16/10/2026, cập nhật 21/10, 22/10, 25/10 và 26/10/2026 · Trạng thái: **bản 0, đã có góp ý của nhóm ngày 17/10**

Dựa trên nhánh `develop` tại commit `c3e6118` (16/10/2026): ADR-0005 tới ADR-0017,
`docs/business/` (account, cart, ordering, events, recommendation),
`infra/lib/api-stack.ts`, `infra/lib/web-stack.ts`, `apps/web/src/shared/auth/`.

Cập nhật 21/10/2026: các quyết định nhóm chốt ngày 17/10, contract `POST /api/v1/events` (#174),
bucket dữ liệu huấn luyện (#179) và kết quả review trust policy OIDC (#180, dòng C6).
Cập nhật 22/10/2026: O6, O8, B6 theo ordering.md (#192, #194).

Cột **Trạng thái**:

- **Đã có**: đã có trong code hoặc hạ tầng, ghi kèm file.
- **Theo thiết kế**: đã ghi trong ADR hoặc tài liệu nghiệp vụ, chưa có code.
- **Đề xuất**: chưa ai làm, cần nhóm đồng ý.
- **Chấp nhận**: rủi ro đã biết, nhóm đồng ý không xử lý thêm ở giai đoạn này.

Cột **Mức** (Cao, Vừa, Thấp) là đánh giá ban đầu của mình về ảnh hưởng nếu xảy ra, chưa
tính khả năng xảy ra. Cần cả nhóm xem lại.

## 1. Phạm vi

Ba luồng theo `docs/team/nhan.md`:

1. **Đăng nhập**: đăng ký, xác nhận email, đăng nhập, phiên, đăng xuất (module `account`, Cognito).
2. **Đặt hàng**: tạo đơn, xem đơn, huỷ đơn, worker xác nhận đơn (module `ordering`, SQS, SES, SNS).
3. **Ghi sự kiện**: `VIEW`, `ADD_TO_CART` từ web, `PURCHASE` từ `ordering` (module `events`).

Ngoài phạm vi bản này, làm ở bản sau:

- Pipeline gợi ý mỗi đêm và bảng `recs` (pipeline làm ở tuần 4).
- Trang admin (chưa có).

Trust policy OIDC và role deploy của CI/CD (ADR-0008) đã review ở #180; kết quả ghi ở dòng C6.

## 2. Phân loại dữ liệu

| Mức | Nghĩa |
|---|---|
| **Bí mật** | Lộ là mất quyền kiểm soát tài khoản hoặc hệ thống |
| **Cá nhân** | Xác định được một người cụ thể |
| **Ẩn danh hoá** | Đã thay định danh bằng HMAC; ai có khoá vẫn nối lại được nên vẫn phải bảo vệ |
| **Nội bộ** | Không gây hại cho khách nếu lộ, nhưng không công bố |
| **Công khai** | Ai cũng xem được |

| Dữ liệu | Nằm ở | Mức | Quy tắc |
|---|---|---|---|
| Mật khẩu | Chỉ Cognito (luồng SRP) | Bí mật | Không bao giờ đi qua code hay log của nhóm |
| Access, ID, refresh token | Cookie trên trình duyệt (`Secure`, `SameSite=Strict`, `apps/web/src/shared/auth/cognito.ts`); header `Authorization` | Bí mật | Không log header `Authorization`. Access token 1 giờ, refresh token 30 ngày (`api-stack.ts`) |
| Khoá HMAC ẩn danh `userId` | SSM Parameter Store, SecureString `/shop/<env>/events/hmac-key`, An tạo bằng CLI, không nằm trong template CDK (events.md mục 2) | Bí mật | Chỉ Lambda `events` và pipeline được đọc; không nằm trong code, không log |
| Email, username | Cognito | Cá nhân | Không chép sang bảng của nhóm; không log |
| `shippingAddress` (họ tên, SĐT, địa chỉ) | Bảng `orders` | Cá nhân | Chỉ chủ đơn và admin xem; không log, không đưa vào `events` hay dữ liệu huấn luyện |
| `userId` (Cognito `sub`) | `carts`, `orders`, bảng idempotency | Cá nhân | Không đưa ra khỏi các module này; `events` chỉ lưu bản HMAC |
| IP người gọi API | Access log của API Gateway, CloudWatch Logs, giữ 14 ngày (`api-stack.ts`) | Cá nhân | Giữ đúng 14 ngày; không chép ra nơi khác |
| `userIdHash`, `itemId`, `eventType`, `timestamp` | Bảng `events`, bucket dữ liệu, bảng `recs` (anchor `FOR_YOU`) | Ẩn danh hoá | Chỉ dùng cho gợi ý; bucket mã hoá SSE-KMS với khoá `aws/s3`, chặn public, bắt buộc TLS (`infra/lib/training-data.ts`) |
| Món trong đơn, tổng tiền, trạng thái đơn | Bảng `orders` | Cá nhân (gắn với `userId`) | Như `shippingAddress` |
| Bảng `recs`, chỉ số mô hình | Bảng `recs`, báo cáo | Nội bộ | Chỉ role của pipeline được ghi |
| Tên, giá, ảnh, mô tả sản phẩm | Bảng `products`, bucket web | Công khai | Chỉ admin được sửa |
| Code, ADR, tài liệu | Repo public (ADR-0015) | Công khai | Không commit secret, account ID, dữ liệu thật |

## 3. Luồng dữ liệu và ranh giới tin cậy

```text
                 B1                                      B3
Trình duyệt ──────────> CloudFront ──> HTTP API ──> Lambda từng module ──> DynamoDB
     │                  (+ WAF,       (JWT authorizer        │
     │ B2                chưa gắn)     Cognito)              ├── B5 ──> SQS ──> worker order-processor ──> SES, SNS
     ▼                                   ▲                   │
  Cognito (SRP)                          │ B4                └── B6 ──> SNS order-confirmed ──> SQS events ──> bảng events (PURCHASE)
                         Gọi thẳng URL execute-api,
                         bỏ qua CloudFront và WAF
```

| Mã | Ranh giới | Cần kiểm soát ở đây |
|---|---|---|
| B1 | Trình duyệt vào CloudFront và API | Không tin dữ liệu từ client, kể cả giá, số lượng, `userId` trong body |
| B2 | Trình duyệt với Cognito | Mật khẩu, mã xác nhận, token đi qua đây |
| B3 | Lambda với DynamoDB | Quyền IAM của từng module chỉ chạm đúng bảng của mình |
| B4 | Internet vào thẳng API Gateway | Request không đi qua WAF (ADR-0006) |
| B5 | API với SQS và worker | Ai được gửi message, worker tin nội dung message tới đâu |
| B6 | `ordering` với `events` | Ai được ghi `PURCHASE`. Chốt 17/10: `ordering` gửi tin lên SNS topic `order-confirmed` (`orderId`, `userId`, `confirmedAt`, `items: [{ productId, quantity }]`, không có `shippingAddress`; ordering.md bước 2.3), topic đẩy vào hàng đợi SQS của `events` có DLQ; chỉ `events` ghi bảng `events`, và băm `userId` bằng HMAC trước khi lưu (E5) |

## 4. Mối đe doạ theo STRIDE

Viết tắt: **S** giả mạo, **T** sửa dữ liệu, **R** chối bỏ, **I** lộ thông tin, **D** từ chối dịch vụ, **E** nâng quyền.

### 4.1. Đăng nhập

| # | STRIDE | Mối đe doạ | Mức | Cách giảm thiểu | Trạng thái |
|---|---|---|---|---|---|
| L1 | S | Dò mật khẩu, credential stuffing | Vừa | Cognito tạm khoá khi thử dồn dập (account.md BR-12); chính sách mật khẩu (BR-04); WAF giới hạn tốc độ | Đã có (Cognito) · Theo thiết kế (WAF, ADR-0006) |
| L2 | I | Dò email đã đăng ký qua trang đăng nhập | Thấp | `preventUserExistenceErrors: true` (`api-stack.ts`); thông báo chung (BR-07) | Đã có |
| L3 | I | Dò email qua trang đăng ký ("Email này đã có tài khoản.") | Thấp | Chấp nhận có chủ ý để đăng ký dễ dùng; WAF giới hạn tốc độ | Chấp nhận (17/10) |
| L4 | S, I | XSS đọc token: cookie do Amplify ghi bằng JavaScript nên không `HttpOnly`, script lạ đọc được refresh token 30 ngày | Vừa | React tự escape; **thêm response headers policy ở CloudFront: CSP, `X-Content-Type-Options`, `X-Frame-Options`, HSTS** (`web-stack.ts` hiện chưa có) | Đề xuất · An làm ở tuần 5 |
| L5 | E | Chiếm tài khoản admin chỉ bằng mật khẩu | Cao | Nhóm `admin` bắt buộc MFA (ADR-0007, account.md BR-10). User pool hiện đặt `Mfa.OPTIONAL`; bắt buộc sẽ làm khi có trang admin | Theo thiết kế |
| L6 | E | Khách tự thêm mình vào nhóm `admin` | Cao | Chỉ An thêm bằng tay trên Cognito (BR-02); backend kiểm `cognito:groups` trong JWT đã ký | Theo thiết kế, cần test khi có API admin |
| L7 | S | App client E2E nhận mật khẩu gửi thẳng (`USER_PASSWORD_AUTH`) bị dùng để dò mật khẩu | Thấp | Chỉ tạo ở dev và staging (`if (!shopEnv.isProd)` trong `api-stack.ts`) | Đã có |
| L8 | D | Spam đăng ký làm hết hạn mức gửi email của user pool, khách thật không nhận được mã | Vừa | Chốt 17/10: giữ email mặc định của Cognito, không chuyển sang SES. Hạn mức khoảng 50 thư mỗi ngày cho cả user pool (`docs/releases/v0.1.0.md`). WAF giới hạn tốc độ; theo dõi lỗi gửi mã | Chấp nhận (17/10) · Theo thiết kế (WAF) |

### 4.2. Đặt hàng

Module `ordering` chưa có code (`services/api/src/modules/` hiện có `account`, `cart`,
`catalog`, `health`). Các dòng dưới là yêu cầu bảo mật để đối chiếu khi viết module.

| # | STRIDE | Mối đe doạ | Mức | Cách giảm thiểu | Trạng thái |
|---|---|---|---|---|---|
| O1 | T | Client sửa giá, tổng tiền | Cao | Server tự tính `totalAmount`, kiểm lại từng món và `expectedPrice` (ordering.md BR-03, BR-06, BR-07) | Theo thiết kế |
| O2 | I, T | IDOR: xem hoặc huỷ đơn người khác bằng cách đổi `orderId` | Cao | `userId` lấy từ JWT, không lấy từ body; đơn của người khác trả 404 (ordering.md) | Theo thiết kế · test IDOR ở tuần 5 |
| O3 | E | Khách tự chuyển đơn sang `SHIPPED`, `DELIVERED` | Cao | Chỉ nhóm `admin` được chuyển; kiểm ở backend, không dựa vào việc giao diện ẩn nút | Theo thiết kế |
| O4 | T | Gửi lại request làm tạo đơn hai lần | Vừa | `Idempotency-Key`, bảng `order-idempotency` riêng (ADR-0017, BR-04) | Theo thiết kế |
| O5 | T | Hai người cùng mua món cuối, bán vượt tồn kho | Vừa | Một `TransactWriteItems` có điều kiện `stock >= quantity` (BR-08) | Theo thiết kế |
| O6 | D | **Giữ kho ác ý:** tạo nhiều đơn COD không định nhận, tồn kho bị trừ, khách thật thấy hết hàng | Vừa | Mỗi tài khoản tối đa 3 đơn `PENDING`, `CONFIRMED`, kiểm bằng bộ đếm `openOrders` trong cùng giao dịch tạo đơn; đơn thứ 4 trả 409 `TOO_MANY_OPEN_ORDERS` (ordering.md BR-14). Admin huỷ đơn để hoàn kho (BR-11, BR-12); throttle riêng cho `POST /api/v1/orders` chưa có | Theo thiết kế (ordering.md BR-14) |
| O7 | E | Role `ordering` có `UpdateItem` trên `products` nên sửa được cả giá, không chỉ tồn kho | Vừa | Đã thử điều kiện `dynamodb:Attributes` chỉ cho `stock`: IAM chặn cả lệnh trừ kho vì điều kiện giao dịch dùng `status`, `price`, nên đã bỏ (ADR-0017). Role chỉ có `UpdateItem` trên `products`, không `PutItem`, `DeleteItem`; code chỉ ghi `stock` | Chấp nhận rủi ro (ADR-0017) · Hoàng phụ trách |
| O8 | I | `shippingAddress` lọt vào log, message SQS hoặc tin SNS `order-confirmed` (topic không có email admin, chốt 24/10) | Vừa | Message SQS chỉ gồm `{orderId, userId, correlationId}` (ordering.md); tin SNS `order-confirmed` gồm `{ orderId, userId, confirmedAt, items: [{ productId, quantity }] }`, không có `shippingAddress`, họ tên, SĐT, giá (ordering.md bước 2.3); không log body request | Theo thiết kế (SQS, SNS) · Đề xuất (log) |
| O9 | T | Message SQS giả hoặc bị sửa | Thấp | Chỉ role API có `sqs:SendMessage` (role worker không có); worker chỉ dùng `orderId`, `userId` của tin làm khoá, đọc lại đơn từ DynamoDB, không tin gì khác trong tin; không thấy đơn thì bỏ tin, ghi log warn. Role worker chỉ có `GetItem`, `UpdateItem` trên bảng orders, không đặt điều kiện `dynamodb:Attributes` (bài học #253/#254; code chỉ ghi `status`, `updatedAt`), chấp nhận rủi ro như O7 | Theo thiết kế (#259, hạ tầng worker) |
| O10 | R | Khách chối đã đặt đơn | Thấp | Đơn lưu `userId` từ JWT, `createdAt`, `correlationId`; email xác nhận | Theo thiết kế |

### 4.3. Ghi sự kiện

Route `POST /api/v1/events` đã có trong `contracts/openapi.yaml` (#174): bắt buộc đăng nhập, body chỉ có `productId` và `eventType` (`VIEW`, `ADD_TO_CART`), `additionalProperties: false`. Module `events` chưa có code.

| # | STRIDE | Mối đe doạ | Mức | Cách giảm thiểu | Trạng thái |
|---|---|---|---|---|---|
| E1 | T | Client gửi `PURCHASE` giả để đẩy sản phẩm lên gợi ý | Cao | API công khai chỉ nhận `VIEW`, `ADD_TO_CART` (enum trong contract, #174); `PURCHASE` chỉ đến từ topic `order-confirmed` khi đơn `CONFIRMED` (events.md mục 1) | Đã có: contract (#174), module (#200), consumer (#252), E2E `events.e2e.ts` |
| E2 | T | **Đầu độc gợi ý:** nhiều tài khoản ảo spam `VIEW`, `ADD_TO_CART` | Cao | Rule WAF riêng cho `/api/events` (ADR-0006); giới hạn trọng số mỗi cặp (user, item); thí nghiệm có số liệu trước và sau ở tuần 5 (nhan.md) | Theo thiết kế · Đề xuất (giới hạn trọng số) |
| E3 | S | Gửi sự kiện mang `userId` của người khác | Vừa | `userId` lấy từ token Cognito, không nhận từ body (events.md mục 5); contract từ chối trường lạ (`additionalProperties: false`, #174) | Đã có: contract, module (#200), E2E `events.e2e.ts` |
| E4 | T | Client gửi `timestamp` giả để làm lệch việc chia train, test theo thời gian | Vừa | Server đặt `timestamp` (events.md mục 3) | Đã có: module (#200), E2E `events.e2e.ts` |
| E5 | I | `userId` thật lọt vào bảng `events` hoặc dữ liệu huấn luyện | Cao | Lưu `HMAC(key, userId)` thay cho `userId` (events.md mục 2); pipeline chỉ xuất các cột cho phép | Theo thiết kế |
| E6 | I | Khoá HMAC bị lộ (trong code, log, repo public) | Cao | SSM SecureString `/shop/<env>/events/hmac-key`, tạo bằng CLI nên không nằm trong repo hay template CloudFormation; chỉ Lambda `events`, Lambda nhận `PURCHASE`, Lambda gợi ý (tra `FOR_YOU#<userIdHash>`) và pipeline có `ssm:GetParameter` trên đúng tham số; một hàm băm dùng chung `services/api/src/shared/userIdHash.ts` không bao giờ log khoá; gitleaks quét mỗi PR | Đã có (Lambda `events`, #204) · Theo thiết kế (gợi ý, pipeline) |
| E7 | D | Spam sự kiện làm tăng chi phí DynamoDB | Vừa | Throttle stage 50 request/giây, burst 100 (`api-stack.ts`); rule WAF cho `/api/events` | Đã có (throttle) · Theo thiết kế (WAF) |
| E8 | E | Role `events` đọc, ghi được bảng của module khác | Vừa | Mỗi module một role, chỉ quyền trên bảng của mình (ADR-0009, ADR-0012); review IAM ở tuần 4 | Theo thiết kế |
| E9 | S, T | Tin giả gửi lên topic `order-confirmed` hoặc thẳng vào hàng đợi `events`, tạo `PURCHASE` giả | Cao | Topic policy Deny `sns:Publish` với mọi principal trừ role worker `order-processor` (`ArnNotEquals aws:PrincipalArn`; Allow không chặn được principal cùng tài khoản đã có quyền trong IAM policy); queue policy chỉ nhận từ đúng topic (`aws:SourceArn`); consumer bỏ tin sai định dạng vào DLQ, không ghi; khoá `PURCHASE` là `<orderId>#<productId>` nên tin giao lại không thành lượt mua thứ hai; role consumer không có `sqs:SendMessage`, `sns:Publish` | Đã có: queue policy (#211), consumer (#252), topic policy (hạ tầng worker) |

### 4.4. Chung cho cả ba luồng

| # | STRIDE | Mối đe doạ | Mức | Cách giảm thiểu | Trạng thái |
|---|---|---|---|---|---|
| C1 | S, D | Gọi thẳng URL `execute-api` bỏ qua CloudFront và WAF (B4) | Vừa | Throttle stage vẫn áp dụng. Thêm header bí mật từ CloudFront và Lambda kiểm header đó; hoặc ghi rõ là giới hạn đã biết (ADR-0006) | Đề xuất |
| C2 | D | WAF chưa gắn: chưa có core rule set, IP reputation, giới hạn tốc độ | Vừa | 5 rule WAF theo ADR-0006 (`web-stack.ts` ghi WAF làm ở bước sau) | Theo thiết kế (tuần 5) |
| C3 | I | Lỗi trả về lộ stack trace, tên bảng | Thấp | Lỗi theo RFC 9457 kèm `traceId`, không lộ stack trace (engineering-plan.md) | Theo thiết kế, kiểm bằng ZAP ở tuần 5 |
| C4 | I | Commit secret hoặc dữ liệu thật vào repo public | Vừa | Mỗi PR chạy gitleaks, `pnpm audit` (check "Security · secrets & dependencies") và CodeQL; chỉ dùng dữ liệu giả lập (ADR-0015) | Đã có |
| C5 | R | Không truy vết được request bất thường | Thấp | Access log API có `requestId`, IP, route, status, giữ 14 ngày (`api-stack.ts`); log WAF khi gắn WAF | Đã có (access log) |
| C6 | E | **Role deploy có quyền admin cả tài khoản:** ba role `gh-deploy-*` được assume mọi role CDK bootstrap, trong đó `cfn-exec-role` mang AdministratorAccess (bootstrap mặc định). Dev, staging, prod chung một tài khoản (ADR-0013) nên role của dev sửa hoặc xoá được `shop-prd` | Cao | Trust policy khớp chính xác `aud` và `sub` (`infra/bootstrap/github-oidc.yaml`). Lớp chặn thật nằm ở GitHub, An kiểm ngày 21/10: environment `dev` chỉ `develop`, `staging` chỉ `release/*`, `production` chỉ tag `v*`, cần 1 trong 3 người duyệt và chặn tự duyệt, không cho admin bỏ qua (tắt ngày 21/10, kiểm lại 26/10); chỉ admin tạo, sửa, xoá được tag `v*`; `develop`, `main` bắt buộc PR và CI xanh. Action bên thứ ba pin theo SHA | Chấp nhận (#180) |

## 5. Việc tiếp theo

Mỗi dòng **Đề xuất** sẽ thành một issue riêng, ghi rõ mức và cách sửa, sau khi nhóm đồng ý:

- [ ] L4: response headers policy (CSP và các header bảo mật) cho CloudFront (An, tuần 5)
- [x] O6: giới hạn 3 đơn đang mở mỗi tài khoản, đã vào ordering.md BR-14 (#192); còn test khi có code (Hoàng)
- [x] O7: đã thử điều kiện `dynamodb:Attributes` cho role `ordering`, IAM chặn giao dịch trừ kho nên bỏ, chấp nhận rủi ro (ADR-0017) (Hoàng)
- [ ] O8, O9: không đưa `shippingAddress` vào tin SNS và log; worker không tin nội dung message
- [ ] C1: chọn cách xử lý việc gọi thẳng `execute-api` (An, tuần 5)
- [x] C6: xác nhận đã tắt "Allow administrators to bypass" của environment `production`; An sửa câu "giới hạn bằng tên stack" trong ADR-0013 cho đúng thực tế (#180)
- [ ] E2: thí nghiệm đầu độc gợi ý ở tuần 5
- [x] E9: queue policy đã có (#211), consumer đã có (25/10); topic policy chặn mọi principal trừ role `order-processor` publish (#263)
- [ ] Bản 1: thêm pipeline gợi ý mỗi đêm, bucket dữ liệu, bảng `recs`, trang admin

## 6. Câu hỏi mở

- Cognito gói Lite có ghi lại lịch sử đăng nhập để truy vết không? Chưa kiểm tra, cần đọc tài liệu AWS trước khi đưa vào bảng.
