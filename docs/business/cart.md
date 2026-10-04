# Tính năng: Giỏ hàng

- Module: cart
- Vai trò: khách hàng đã đăng nhập
- Người viết: Hoàng · Ngày: 01/10/2026 · Sửa: 03/10/2026 (giới hạn theo tồn kho, khách chưa đăng nhập, cờ đổi giá)

## User story

Là khách hàng, tôi muốn thêm sản phẩm vào giỏ, điều chỉnh số lượng và xoá sản phẩm để chuẩn bị đặt hàng.

## Quy tắc nghiệp vụ

- BR-01: Bắt buộc đăng nhập để dùng giỏ hàng; MVP không có giỏ cho khách vãng lai. Khách chưa đăng nhập bấm "Thêm vào giỏ" → chuyển sang trang đăng nhập → đăng nhập xong thì quay lại trang sản phẩm đó và tự thêm món vào giỏ.
- BR-02: Mỗi người dùng có đúng một giỏ hàng; giỏ có tối đa 50 dòng sản phẩm.
- BR-03: Số lượng mỗi món trong giỏ từ 1 tới **giá trị nhỏ hơn giữa 99 và tồn kho hiện tại**.
- BR-04: Món đã có trong giỏ thì thêm lại sẽ cộng dồn số lượng, không tạo dòng mới. Cộng dồn mà vượt giới hạn ở BR-03 → trả 409 `QUANTITY_LIMIT` kèm số còn thêm được (`maxAddable`); giỏ giữ nguyên.
- BR-05: Giỏ hàng không có thời hạn hết hạn (TTL) trong MVP.
- BR-06: Giá hiển thị trong giỏ luôn là giá hiện tại trong bảng `products`. Mỗi dòng lưu `addedPrice`, là giá lúc khách thêm hoặc sửa số lượng gần nhất. Giá hiện tại khác `addedPrice` → hiển thị cờ "Giá đã thay đổi". Cờ mất khi khách sửa số lượng hoặc thêm lại món đó, vì lúc đó `addedPrice` được cập nhật.
- BR-07: Món trong giỏ không đặt được (không tick chọn được) khi:
  - Hết hàng (`stock = 0`) → nhãn "Hết hàng"
  - Tồn kho thấp hơn số lượng trong giỏ (`0 < stock < quantity`) → nhãn "Chỉ còn X sản phẩm"; khách giảm số lượng thì đặt được
  - Đã ngừng bán (`INACTIVE`) → nhãn "Ngừng bán"
  Các món này vẫn ở trong giỏ cho tới khi khách tự xoá.
- BR-08: Xoá sản phẩm khỏi giỏ không ảnh hưởng tới sản phẩm đó trong catalog.
- BR-09: Tổng tiền của giỏ (`totalAmount`) chỉ tính các món đặt được theo BR-07. Trang giỏ hiển thị tổng của các món đang được tick chọn.

## Trường hợp đặc biệt

- Thêm sản phẩm `INACTIVE` vào giỏ → 409 `PRODUCT_UNAVAILABLE`.
- Thêm hoặc sửa số lượng vượt tồn kho hoặc vượt 99 → 409 `QUANTITY_LIMIT` kèm `maxAddable`.
- Số lượng nhỏ hơn 1 hoặc không phải số nguyên → 400.
- `productId` không tồn tại khi thêm giỏ → 404.
- Giỏ đã đủ 50 dòng mà thêm món mới → 409 `CART_FULL`.
- Sửa hoặc xoá món không có trong giỏ → 404.
- Giỏ rỗng khi checkout → frontend chặn, không gửi request; nếu vẫn gửi thì server trả 400.

## Tiêu chí nghiệm thu

- Given khách chưa đăng nhập, When gọi `GET /api/v1/cart`, Then trả 401.
- Given khách chưa đăng nhập ở trang sản phẩm A, When bấm "Thêm vào giỏ" rồi đăng nhập, Then quay lại trang A và giỏ có món A.
- Given giỏ rỗng, When gọi `GET /api/v1/cart`, Then trả `{ "items": [], "totalAmount": 0 }`.
- Given sản phẩm chưa có trong giỏ, When gọi `POST /api/v1/cart/items` với `productId` và `quantity: 2`, Then giỏ có 1 dòng với `quantity: 2`.
- Given sản phẩm đã có trong giỏ với `quantity: 1` và tồn kho 10, When thêm lại `quantity: 3`, Then giỏ có `quantity: 4`.
- Given giỏ có món A `quantity: 8` và tồn kho 10, When thêm `quantity: 5`, Then trả 409 `QUANTITY_LIMIT` với `maxAddable: 2` và giỏ vẫn là 8.
- Given sản phẩm trong giỏ, When gọi `PUT /api/v1/cart/items/{productId}` với `quantity: 5`, Then số lượng cập nhật thành 5.
- Given sản phẩm trong giỏ, When gọi `DELETE /api/v1/cart/items/{productId}`, Then sản phẩm biến mất khỏi giỏ.
- Given giá sản phẩm đổi từ 500.000 lên 600.000, When xem giỏ, Then hiển thị giá 600.000 kèm `priceChanged: true`. When khách sửa số lượng món đó, Then `priceChanged: false`.
- Given giỏ có món A `quantity: 3` mà tồn kho giảm còn 1, When xem giỏ, Then món A có nhãn "Chỉ còn 1 sản phẩm", không tick chọn được và không tính vào `totalAmount`.

## Màn hình liên quan

- `/cart` — trang giỏ hàng: danh sách sản phẩm, ô tick chọn, sửa số lượng, tổng tiền các món đã chọn, nút "Đặt hàng".
