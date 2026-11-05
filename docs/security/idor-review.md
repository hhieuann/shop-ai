# Rà soát IDOR (threat model O2)

Người viết: Nhân · Ngày: 27/10/2026 · Dựa trên `develop` sau #294.

IDOR (Insecure Direct Object Reference): người dùng đổi một mã trong request (mã đơn, mã người dùng, cursor) để đọc hoặc sửa dữ liệu của người khác.

## Cách hệ thống chặn

- Route có dữ liệu riêng đều gắn JWT authorizer của Cognito; handler lấy `userId` từ claim `sub` của token (`handler.ts` của cart, ordering, events, recommendation, account), **không** nhận `userId` từ body, query hay path.
- Dữ liệu riêng đều có khoá chính bắt đầu bằng `userId` (`carts`, `orders`) hoặc bản băm của nó (`events`, `recs` FOR_YOU), nên mọi lần đọc, ghi chỉ chạm được partition của người trong token. Mã do client gửi (`orderId`, `productId`, cursor) chỉ là phần sau của khoá.
- Không tìm thấy và "của người khác" cùng trả 404, không 403, để không lộ việc mã đó có tồn tại.
- Phản hồi dữ liệu riêng có `Cache-Control: no-store`; CloudFront tắt cache cho `/api/*` trừ `/api/v1/products*` (`web-stack.ts`).

## Từng route

| Route | Mã client gửi | Khoá đọc, ghi | Kết quả với mã của người khác | Bằng chứng |
|---|---|---|---|---|
| `GET /api/v1/me` | không | claim của token | không có đường nào | E2E `idor.e2e.ts` (401, no-store) |
| `GET /api/v1/cart`, `POST /cart/items`, `PUT`, `DELETE /cart/items/{productId}`, `POST /cart/merge` | `productId` | `carts`: `userId` (token) | chỉ sửa giỏ của chính mình; `productId` là món trong giỏ đó | code `cart/routes.ts`; E2E (401, no-store) |
| `POST /api/v1/orders` | món, địa chỉ | `orders`: `userId` (token) + `orderId` do server sinh | không đặt hộ người khác được | code `ordering/routes.ts` |
| `GET /api/v1/orders` | `cursor` | `userId` (token); cursor chỉ chứa `orderId`, kiểm dạng ULID | cursor sửa tay: sai dạng → 400; đúng dạng → vẫn chỉ đơn của mình | `history.ts`; integration `listByUser_returnsOnlyOwnOrders`; E2E cursor tự chế |
| `GET /api/v1/orders/{orderId}` | `orderId` | `GetItem(userId của token, orderId)` | 404 | integration `getOrder_throwsNotFound_whenOrderBelongsToAnotherUser`; E2E `getOrder_returns404_whenOrderNotOwned` |
| `DELETE /api/v1/orders/{orderId}` | `orderId` | đọc như trên rồi mới huỷ | 404, không huỷ, không hoàn kho, không gửi tin | integration `cancelOrder_throwsNotFound_andWritesNothing_whenOrderBelongsToAnotherUser`; E2E `cancelOrder_returns404_forOrderIdNotOwned` |
| `POST /api/v1/events` | `productId`, `eventType` | `userIdHash` từ token | body có `userId` → 400 | E2E `events.e2e.ts` (E3) |
| `GET /api/v1/recs/for-you` | `exclude`, `limit` | `FOR_YOU#<HMAC(sub)>` | không chọn được người khác | code `recommendation/routes.ts`; E2E (401, no-store) |
| `GET /api/v1/products*`, `/recs/also-bought`, `/recs/bestsellers` | mã sản phẩm, loại | dữ liệu công khai | không có dữ liệu riêng | — |

## Kết luận

Không tìm thấy IDOR. Ca "người khác biết đúng `orderId`" được kiểm ở integration test vì bộ E2E chỉ có một người dùng; muốn kiểm qua API thật thì cần thêm người dùng E2E thứ hai (An tạo trên Cognito dev, staging).

Chưa có trang admin; khi làm cần rà lại vì admin đọc, sửa đơn của mọi người (O3).
