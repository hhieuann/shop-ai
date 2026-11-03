# Báo cáo bảo mật shop-ai

Người viết: Nhân · Ngày: 29/10/2026 (bản nháp) · Dựa trên `develop` sau #301.

Báo cáo gom lại những gì nhóm đã làm về bảo mật từ tuần 1 tới tuần 5: mô hình mối đe doạ, các kiểm tra
đã chạy, kết quả, và rủi ro còn mở. Chi tiết từng dòng nằm ở [threat-model.md](threat-model.md); báo
cáo này không lặp lại mà chỉ tóm tắt và dẫn bằng chứng.

## 1. Phạm vi

- Ba luồng chính: đăng nhập (Cognito), đặt hàng (`ordering`, SQS, worker gửi email), ghi sự kiện và
  gợi ý (`events`, pipeline mỗi đêm, bảng `recs`).
- Hạ tầng: CloudFront, API Gateway HTTP API, Lambda, DynamoDB, SNS, SQS, SSM; dev, staging, prod chung
  một tài khoản AWS (ADR-0013).
- Ngoài phạm vi: trang admin (chưa có), thanh toán online (chỉ COD), kiểm thử xâm nhập chủ động
  (active scan) trên môi trường thật.

## 2. Cách làm

| Hoạt động | Ngày | Kết quả, bằng chứng |
|---|---|---|
| Threat model STRIDE, phân loại dữ liệu, ranh giới tin cậy | 16/10, cập nhật tới 27/10 | 34 mối đe doạ (L1–L8, O1–O11, E1–E9, C1–C6), [threat-model.md](threat-model.md) |
| Review trust policy OIDC cho role deploy | 21/10 | Dòng C6, #180 |
| Rà soát IAM theo từng module (điều kiện `dynamodb:Attributes`, `Select`) | 22–26/10 | ADR-0017; pipeline chỉ Scan 4 cột `products` (#275); pre sign-up chỉ `ListUsers` trên pool cùng môi trường (#305) |
| Test chống giả mạo sự kiện (E1, E3, E4) | 26/10 | E2E `tests/e2e-api/events.e2e.ts` (#277) |
| Thí nghiệm đầu độc gợi ý (E2) | 27/10 | [poisoning-experiment.md](poisoning-experiment.md) (#290) |
| Rà soát IDOR (O2) | 27/10 | [idor-review.md](idor-review.md), integration test và E2E `idor.e2e.ts` 11 ca (#296) |
| Quét ZAP baseline vào dev (L4, C3) | 27/10, 10:37–10:38 | Tóm tắt trong threat model L4, C3 (#298, #301); báo cáo HTML không commit |
| Kiểm tra tự động mỗi PR | liên tục | gitleaks, `pnpm audit`, CodeQL, cdk-nag (C4) |

## 3. Kết quả chính

### 3.1. Đầu độc gợi ý (E2)

Kẻ tấn công tạo tài khoản ảo, spam `VIEW`, `ADD_TO_CART` một sản phẩm ít người mua.

| Cách gộp sự kiện | 50 tài khoản × 50 lần lặp (4 seed) | Không tấn công |
|---|---|---|
| `sum` (cộng dồn) | 38.8% – 43.2% người dùng thấy mục tiêu | — |
| `max` (pipeline đang dùng) | 0.3% – 2.0% | 0% – 3.3% |

- Lấy trọng số lớn nhất cho mỗi cặp (người dùng, sản phẩm) làm spam lặp lại vô tác dụng.
- "Thường mua kèm" không bị ảnh hưởng vì chỉ học từ `PURCHASE`; client gửi `PURCHASE` bị 400,
  `PURCHASE` chỉ đến từ đơn đã xác nhận qua topic `order-confirmed` (#252).
- Còn lại: nhiều tài khoản, mỗi cái một lượt. Chặn bằng rule WAF cho `/api/v1/events` (v1.0.0-rc.1).

### 3.2. IDOR (O2)

Không tìm thấy IDOR. `userId` luôn lấy từ claim `sub` của JWT, khoá bảng bắt đầu bằng `userId` hoặc
bản băm của nó, đơn của người khác trả 404, phản hồi dữ liệu riêng có `Cache-Control: no-store`.

### 3.3. ZAP baseline (L4, C3)

0 FAIL, 12 WARN, 56 PASS trên 10 URL.

- Thiếu header bảo mật: CSP, `X-Frame-Options` (Vừa); `X-Content-Type-Options`, HSTS,
  `Permissions-Policy` (Thấp). Sửa bằng `ResponseHeadersPolicy` ở CloudFront (#299, An, sau v0.2.0).
- SRI, COEP: chấp nhận, không áp dụng (Google Fonts), theo góp ý của An (#301).
- Không lộ lỗi hay stack trace trên trang web. Baseline chưa gọi đường lỗi `/api`.

### 3.4. Dữ liệu cá nhân trong pipeline gợi ý (E5, E6)

- Bảng `events` lưu `HMAC(key, userId)`, không lưu `userId` (test
  `recordEvent_storesHashInsteadOfUserId_withServerTimeAnd90DayTtl`, `recordPurchase_hashesUserOnce_perMessage`).
- Khoá HMAC ở SSM SecureString, không nằm trong repo hay template (E6).
- Pipeline mỗi đêm in 1 dòng log JSON chỉ có số lượng và điểm, không có mã người dùng (#294).
- Dev, staging trộn dữ liệu giả lập; prod `SYNTHETIC=0`, chỉ dùng sự kiện thật (An xác nhận 26/10).

## 4. Tình trạng theo threat model

Đếm theo cột Trạng thái của [threat-model.md](threat-model.md) ngày 29/10 (một dòng có thể vừa "Đã có"
một phần vừa "Theo thiết kế" phần còn lại).

| Mức | Số dòng | Đã có, toàn phần hoặc một phần | Còn mở (Đề xuất, Theo thiết kế) | Chấp nhận |
|---|---|---|---|---|
| Cao | 11 | O2, E1, E2, E6, E9 | L5, L6, O1, O3, E5 | C6 |
| Vừa | 16 | L1, E3, E4, E7, C4 | L4, O4, O5, O6, O8, O11, E8, C1, C2 | L8, O7 |
| Thấp | 7 | L2, L7, C3, C5 | O9, O10 | L3 |

### 4.1. Dòng cần cập nhật trạng thái

Đối chiếu code ngày 29/10, các dòng sau đã có code nhưng threat model vẫn ghi "Theo thiết kế". Cần
người phụ trách xác nhận rồi mới sửa threat model:

| Dòng | Bằng chứng trong code | Người xác nhận |
|---|---|---|
| O1 (giá, tổng tiền do server tính) | `checkItems_throwsPriceChangedWithCurrentPrice_whenPriceDiffers`; điều kiện `price = :price` trong `dynamoOrderStore.ts` | Hoàng |
| O4 (idempotency) | `createOrder_returns400_whenIdempotencyKeyMissing`, `placeOrder_throwsIdempotencyKeyReused_whenMarkerHasDifferentHash` | Hoàng |
| O5 (bán vượt tồn kho) | `ConditionExpression: 'stock >= :qty AND ...'` trong `dynamoOrderStore.ts` | Hoàng |
| O6 (giữ kho ác ý) | bộ đếm `openOrders` trong `dynamoOrderStore.ts` | Hoàng |
| O8 (SNS không có dữ liệu cá nhân) | `orderConfirmedEvent_hasNoPersonalDataOrPrice` | Hoàng |
| E5 (`userId` thật không vào bảng `events`) | test ở mục 3.4 | Nhân |

### 4.2. Rủi ro còn mở, theo thứ tự ưu tiên

| # | Rủi ro | Mức | Việc tiếp theo | Người, hạn |
|---|---|---|---|---|
| C2, E2, E7, L1 | Chưa có WAF: chưa giới hạn tốc độ, chưa core rule set | Vừa | WebACL 5 rule theo ADR-0006, trả theo dùng, chỉ gắn ở prod (khoảng $10/tháng); bỏ gói CloudFront Free vì tài khoản ở Free account plan không đăng ký được (chốt 29/10). Dev, staging không có WAF | Nhân, v1.0.0-rc.1 (09/11) |
| L4 | Thiếu header bảo mật, XSS đọc được token | Vừa | `ResponseHeadersPolicy` (#299) | An, sau v0.2.0 |
| C1 | Gọi thẳng `execute-api` bỏ qua CloudFront, WAF | Vừa | Header bí mật hoặc ghi là giới hạn đã biết | An |
| L5, L6, O3 | Quyền admin: MFA, chuyển trạng thái đơn | Cao | Làm cùng trang admin; rà lại IDOR cho route admin | Khi có trang admin |
| O2 (API) | Ca "biết đúng `orderId` của người khác" mới kiểm ở integration test | Thấp | Thêm người dùng E2E thứ hai | An tạo user, Nhân viết test |

## 5. Giới hạn của báo cáo

- Chưa chạy active scan hay kiểm thử xâm nhập; ZAP chỉ chạy baseline (thụ động) trên dev theo điều
  kiện An đặt.
- Thí nghiệm đầu độc dùng dữ liệu giả lập, cho thấy cơ chế chứ không phải mức thiệt hại thật.
- Mức (Cao, Vừa, Thấp) là đánh giá của nhóm, chưa tính khả năng xảy ra.
- Bản nháp: sẽ cập nhật sau v0.2.0 (02/11) và sau khi gắn WAF.
