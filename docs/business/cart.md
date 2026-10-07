# Tính năng: Giỏ hàng

- Module: cart
- Vai trò: khách vãng lai (chưa đăng nhập), khách hàng đã đăng nhập
- Người viết: Hoàng · Ngày: 01/10/2026 · Sửa: 03/10/2026 (giới hạn theo tồn kho, cờ đổi giá); 07/10/2026 (giỏ cho khách vãng lai, gộp giỏ khi đăng nhập)

## User story

Là khách hàng, kể cả khi chưa đăng nhập, tôi muốn thêm sản phẩm vào giỏ, điều chỉnh số lượng và xoá sản phẩm để chuẩn bị đặt hàng. Chỉ khi đặt hàng tôi mới cần đăng nhập hoặc tạo tài khoản, và không mất các món đã chọn.

## Quy tắc nghiệp vụ

- BR-01: **Khách vãng lai dùng giỏ được, không cần đăng nhập.**
  - Giỏ của khách vãng lai (gọi tắt là *giỏ khách*) lưu **trên trình duyệt** (`localStorage`), chỉ gồm `productId`, `quantity`, `addedPrice` của từng dòng. Không gửi lên server cho tới khi đăng nhập; đổi máy hoặc đổi trình duyệt thì không thấy giỏ khách.
  - Giỏ khách theo cùng luật BR-02 … BR-09. Tên, ảnh, giá, tồn kho, trạng thái luôn lấy mới từ catalog (`GET /api/v1/products/{productId}`), web tự kiểm giới hạn số lượng theo tồn kho đó.
  - API `/api/v1/cart*` **vẫn bắt buộc đăng nhập** (401 nếu chưa). Đã đăng nhập thì chỉ dùng giỏ tài khoản trên server.
  - **Đặt hàng vẫn bắt buộc đăng nhập** (ordering BR-01). Khách vãng lai bấm "Đặt hàng" → trang đăng nhập (có lối sang tạo tài khoản) → thành công → gộp giỏ (BR-10) → sang trang checkout điền thông tin nhận hàng và phương thức thanh toán.
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
- BR-10: **Gộp giỏ khi đăng nhập hoặc tạo tài khoản thành công.** Web gửi toàn bộ giỏ khách trong một lần `POST /api/v1/cart/merge`:
  - Món đã có trong giỏ tài khoản → **cộng dồn**, nhưng không vượt min(99, tồn kho) (BR-03); phần vượt bị bỏ, không báo lỗi 409.
  - Món chưa có → thêm dòng mới, nếu giỏ còn chỗ (BR-02, tối đa 50 dòng).
  - Món ngừng bán, hết hàng hoặc không còn trong catalog → bỏ qua.
  - Server trả giỏ sau khi gộp **và** danh sách món bị điều chỉnh (số lượng bị chặn, bị bỏ qua) để web báo cho khách.
  - Bắt buộc header `Idempotency-Key`: gọi lại cùng khoá (mạng lỗi, bấm lại) trả cùng kết quả, không cộng dồn lần hai.
  - Gộp thành công → web xoá giỏ khách. Gộp thất bại → giữ giỏ khách, lần đăng nhập sau gộp lại.
- BR-11: **Sau khi gộp, đi tiếp tới đâu** (khi khách đăng nhập từ nút "Đặt hàng"):
  - Các món khách đã tick được gộp **đúng số lượng** khách đã chọn (giỏ tài khoản chưa có món đó, không món nào bị chặn hay bỏ qua) → sang thẳng trang checkout với các món đó.
  - Ngược lại (món đã tick trùng với món trong giỏ tài khoản nên số lượng đổi, hoặc có món bị chặn, bỏ qua) → về trang giỏ hàng (không hiện thông báo riêng; số lượng và nhãn trên từng dòng đã cho thấy thay đổi), để khách xem lại rồi bấm "Đặt hàng" lần nữa. Không đưa khách vào checkout với số lượng khác cái họ vừa chọn.
  - Khách đăng nhập theo cách khác (bấm "Tài khoản" trên header) → vẫn gộp giỏ, rồi ở lại trang đang xem.

## Trường hợp đặc biệt

- Thêm sản phẩm `INACTIVE` vào giỏ → 409 `PRODUCT_UNAVAILABLE`.
- Thêm hoặc sửa số lượng vượt tồn kho hoặc vượt 99 → 409 `QUANTITY_LIMIT` kèm `maxAddable`.
- Số lượng nhỏ hơn 1 hoặc không phải số nguyên → 400.
- `productId` không tồn tại khi thêm giỏ → 404.
- Giỏ đã đủ 50 dòng mà thêm món mới → 409 `CART_FULL`.
- Sửa hoặc xoá món không có trong giỏ → 404.
- Giỏ rỗng khi checkout → frontend chặn, không gửi request; nếu vẫn gửi thì server trả 400.
- Gộp giỏ với danh sách rỗng, hơn 50 dòng, `productId` trùng nhau trong cùng request, hoặc số lượng ngoài 1 … 99 → 400.
- Gộp giỏ thiếu `Idempotency-Key` → 400. Cùng khoá nhưng nội dung khác → 422 `IDEMPOTENCY_KEY_REUSED`.
- Giỏ khách trên trình duyệt bị sửa tay (số lượng âm, `productId` lạ) → web bỏ dòng hỏng khi đọc; server vẫn kiểm lại khi gộp.
- Khách đang đăng nhập rồi đăng xuất → trình duyệt bắt đầu một giỏ khách rỗng; giỏ tài khoản vẫn ở server.

## Tiêu chí nghiệm thu

- Given khách chưa đăng nhập, When gọi `GET /api/v1/cart`, Then trả 401.
- Given khách vãng lai ở trang sản phẩm A, When bấm "Thêm vào giỏ", Then giỏ khách có món A, không bị chuyển sang trang đăng nhập.
- Given khách vãng lai có món A trong giỏ, When tải lại trang hoặc đóng mở trình duyệt, Then giỏ vẫn còn món A.
- Given khách vãng lai tick món A, B, When bấm "Đặt hàng", Then chuyển sang trang đăng nhập; When đăng nhập thành công và giỏ tài khoản chưa có A, B, Then sang trang checkout với đúng A, B và số lượng đã chọn.
- Given khách vãng lai, When bấm "Đặt hàng" rồi chọn tạo tài khoản và hoàn tất, Then cũng gộp giỏ và sang trang checkout như trên.
- Given giỏ tài khoản có A `quantity: 2`, giỏ khách có A `quantity: 3`, tồn kho A là 10, When gộp, Then giỏ tài khoản có A `quantity: 5` và khách được đưa về trang giỏ (không sang thẳng checkout).
- Given giỏ tài khoản có A `quantity: 8`, giỏ khách có A `quantity: 5`, tồn kho A là 10, When gộp, Then A `quantity: 10` và danh sách điều chỉnh báo A bị chặn ở 10.
- Given giỏ khách có món đã ngừng bán, When gộp, Then món đó bị bỏ qua và có trong danh sách điều chỉnh.
- Given gộp giỏ thành công với Idempotency-Key K, When gọi lại với cùng K, Then giỏ không cộng dồn thêm lần nữa.
- Given giỏ rỗng, When gọi `GET /api/v1/cart`, Then trả `{ "items": [], "totalAmount": 0 }`.
- Given sản phẩm chưa có trong giỏ, When gọi `POST /api/v1/cart/items` với `productId` và `quantity: 2`, Then giỏ có 1 dòng với `quantity: 2`.
- Given sản phẩm đã có trong giỏ với `quantity: 1` và tồn kho 10, When thêm lại `quantity: 3`, Then giỏ có `quantity: 4`.
- Given giỏ có món A `quantity: 8` và tồn kho 10, When thêm `quantity: 5`, Then trả 409 `QUANTITY_LIMIT` với `maxAddable: 2` và giỏ vẫn là 8.
- Given sản phẩm trong giỏ, When gọi `PUT /api/v1/cart/items/{productId}` với `quantity: 5`, Then số lượng cập nhật thành 5.
- Given sản phẩm trong giỏ, When gọi `DELETE /api/v1/cart/items/{productId}`, Then sản phẩm biến mất khỏi giỏ.
- Given giá sản phẩm đổi từ 500.000 lên 600.000, When xem giỏ, Then hiển thị giá 600.000 kèm `priceChanged: true`. When khách sửa số lượng món đó, Then `priceChanged: false`.
- Given giỏ có món A `quantity: 3` mà tồn kho giảm còn 1, When xem giỏ, Then món A có nhãn "Chỉ còn 1 sản phẩm", không tick chọn được và không tính vào `totalAmount`.

## Màn hình liên quan

- `/cart` — trang giỏ hàng: danh sách sản phẩm, ô tick chọn, sửa số lượng, tổng tiền các món đã chọn, nút "Đặt hàng". Dùng chung cho khách vãng lai (giỏ khách) và khách đã đăng nhập (giỏ tài khoản).
- `/login`, `/register` — khi đến từ nút "Đặt hàng", đăng nhập hoặc tạo tài khoản xong thì gộp giỏ rồi đi tiếp theo BR-11.
