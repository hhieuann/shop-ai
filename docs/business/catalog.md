# Tính năng: Xem và tìm sản phẩm (Catalog)

- Module: catalog
- Vai trò: khách chưa đăng nhập, khách hàng, admin (mục "Admin quản lý sản phẩm")
- Người viết: Hoàng · Ngày: 01/10/2026 · Sửa: 03/10/2026 (tìm kiếm, loại hàng, sắp xếp) · 25/11/2026 (admin quản lý sản phẩm, BR-09 … BR-15)

## User story

Là khách truy cập, tôi muốn xem danh sách sản phẩm, lọc theo loại và tìm kiếm theo tên để nhanh chóng tìm được linh kiện mình cần.

## Quy tắc nghiệp vụ

- BR-01: Danh sách sản phẩm trả về mặc định 20 sản phẩm, tối đa 50 mỗi trang, phân trang bằng cursor.
- BR-02: Có thể lọc theo `category`. Có 13 loại, khớp danh mục trong `project-plan.md`:

  | Nhóm | `category` |
  |---|---|
  | Laptop, PC dựng sẵn | `laptop` |
  | Linh kiện PC | `cpu`, `gpu`, `ram`, `storage` (SSD, HDD), `mainboard`, `psu`, `cooling` |
  | Thiết bị ngoại vi | `keyboard`, `mouse`, `monitor`, `headset` |
  | Phụ kiện | `accessory` (túi, balo laptop, hub USB, cáp, đế tản nhiệt) |
- BR-03: Tìm kiếm theo tên sản phẩm bằng tham số `q`:
  - Không phân biệt chữ hoa, chữ thường và dấu tiếng Việt (`rtx` = `RTX`; `chuot` khớp "Chuột")
  - Khớp ở bất kỳ vị trí nào trong tên (`rtx` khớp "ASUS TUF Gaming GeForce RTX 4070")
  - Tìm trên toàn bộ sản phẩm ACTIVE; dùng kèm `category` thì chỉ tìm trong loại đó
  - `q` dài 1–30 ký tự sau khi bỏ khoảng trắng hai đầu; ô tìm kiếm rỗng thì web không gửi `q`
  - Kết quả phân trang như danh sách thường (BR-01)
- BR-04: Sản phẩm có `status = INACTIVE` không hiển thị cho khách, kể cả ở trang chi tiết (trả 404).
- BR-05: Giá niêm yết là số nguyên VND, không có giảm giá (ngoài phạm vi MVP).
- BR-06: Không kiểm tra tương thích linh kiện (ngoài phạm vi MVP).
- BR-07: Không có biến thể sản phẩm (ví dụ: màu, size) trong MVP.
- BR-08: Sắp xếp bằng tham số `sort`:
  - `newest` (mặc định): mới nhất trước, theo `createdAt`
  - `price_asc`: giá tăng dần
  - `price_desc`: giá giảm dần
  - Với mọi cách sắp xếp, sản phẩm hết hàng luôn nằm cuối danh sách.

## Thuộc tính sản phẩm

| Thuộc tính | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `productId` | string (ULID) | ✅ | Khoá chính |
| `name` | string | ✅ | Tên sản phẩm |
| `category` | enum | ✅ | Xem BR-02 |
| `brand` | string | ✅ | Hãng sản xuất |
| `price` | number (VND) | ✅ | Số nguyên |
| `stock` | number | ✅ | Số lượng tồn kho |
| `status` | ACTIVE / INACTIVE | ✅ | Mặc định ACTIVE |
| `deletedAt` | ISO 8601 UTC | ❌ | Chỉ có khi admin xoá mềm (BR-14); không trả ra API khách |
| `description` | string | ✅ | Mô tả ngắn |
| `imageUrl` | string (URL) | ❌ | URL ảnh sản phẩm |
| `specs` | object | ❌ | Thông số kỹ thuật (tuỳ category) |
| `createdAt` | ISO 8601 UTC | ✅ | Tự điền khi tạo |
| `updatedAt` | ISO 8601 UTC | ✅ | Cập nhật khi sửa |

## Trường hợp đặc biệt

- Danh mục trống (chưa có sản phẩm) → trả về mảng rỗng, không báo lỗi.
- `cursor` không hợp lệ → trả lỗi 400 Bad Request.
- Tìm kiếm không có kết quả → trả về mảng rỗng.
- `q` dài hơn 30 ký tự → trả lỗi 400 (web chặn sẵn bằng `maxLength`, chỉ gặp khi gọi API trực tiếp).
- Tên sản phẩm vừa đổi có thể chậm tối đa 60 giây mới tìm thấy theo tên mới (cache CloudFront và cache trong Lambda).
- Sản phẩm hết hàng (`stock = 0`) → vẫn hiển thị nhưng đánh dấu "Hết hàng" và nằm cuối danh sách.
- `sort` không thuộc 3 giá trị trên → 400.
- Danh sách được cache 60 giây nên có thể hiện "còn hàng" trong khi thực tế vừa hết. Chấp nhận được vì lúc đặt hàng server kiểm lại tồn kho (ordering BR-03).

## Tiêu chí nghiệm thu

- Given danh sách sản phẩm, When gọi `GET /api/v1/products`, Then trả về tối đa 20 sản phẩm ACTIVE kèm `nextCursor`.
- Given có filter `?category=gpu`, When gọi `GET /api/v1/products?category=gpu`, Then chỉ trả sản phẩm category GPU.
- Given sản phẩm INACTIVE, When gọi danh sách, Then sản phẩm đó không xuất hiện.
- Given có sản phẩm "ASUS TUF Gaming GeForce RTX 4070", When gọi `GET /api/v1/products?q=rtx` (hoặc `q=RTX`), Then sản phẩm đó có trong kết quả.
- Given có sản phẩm "Chuột Logitech G502", When gọi `GET /api/v1/products?q=chuot`, Then sản phẩm đó có trong kết quả.
- Given `q=rtx&category=mouse`, When gọi danh sách, Then chỉ trả chuột có "rtx" trong tên (thường là mảng rỗng).
- Given `productId` hợp lệ, When gọi `GET /api/v1/products/{productId}`, Then trả đủ thông tin chi tiết.
- Given `productId` không tồn tại, When gọi chi tiết, Then trả 404 Problem JSON.
- Given sản phẩm `INACTIVE`, When gọi chi tiết, Then trả 404.
- Given có 3 sản phẩm còn hàng giá 1, 3, 2 triệu và 1 sản phẩm hết hàng giá 0,5 triệu, When gọi `?sort=price_asc`, Then thứ tự là 1, 2, 3 triệu rồi mới tới sản phẩm hết hàng.
- Given không truyền `sort`, When gọi danh sách, Then sản phẩm mới nhất (còn hàng) đứng đầu.
- Given danh sách sản phẩm, When thay đổi giá một sản phẩm, Then response tiếp theo phản ánh giá mới (cache CloudFront TTL 60 giây).

## Màn hình liên quan

- `/` hoặc `/products` — trang danh sách: grid sản phẩm, bộ lọc loại, ô sắp xếp, ô tìm kiếm phía trên. Từ khoá, loại và cách sắp xếp nằm trên URL (`/products?q=rtx&category=gpu&sort=price_asc`) để chia sẻ link được.
- `/products/:productId` — trang chi tiết: ảnh, tên, giá, mô tả, specs, nút "Thêm vào giỏ", widget gợi ý (An làm).

## Admin quản lý sản phẩm (#543, 25/11/2026)

User story: là admin, tôi muốn thêm, sửa, ẩn và xoá sản phẩm để danh mục luôn đúng hàng đang bán mà không phải sửa file seed.

API: `/api/v1/admin/products` (contracts/openapi.yaml, tag `admin`). Màn hình: [pages/admin-san-pham.md](../web/pages/admin-san-pham.md).

### Quy tắc nghiệp vụ

- BR-09: Chỉ nhóm `admin` của Cognito. Không có token → 401; đã đăng nhập nhưng không thuộc nhóm → 403 `FORBIDDEN` (như API admin đơn hàng). Mọi response `Cache-Control: no-store`.
- BR-10: Danh sách theo **một** loại (`category` bắt buộc):
  - Lọc `status`: bỏ trống thì gồm đang bán (`ACTIVE`) và đã ẩn (`INACTIVE`); hoặc riêng `ACTIVE`, `INACTIVE`, `DELETED` (đã xoá mềm, BR-14).
  - `q` tìm theo tên 1–30 ký tự, cùng cách như BR-03.
  - Mới nhất trước (theo `productId` ULID). Phân trang cursor, mặc định 20, tối đa 50.
  - Trả kèm `counts` gồm `active`, `inactive`, `deleted` của loại đó (không phụ thuộc `q`, `status`) để hiện số trên nút lọc.
- BR-11: Thêm sản phẩm:
  - Server sinh `productId` (ULID), `createdAt` = `updatedAt` = lúc tạo, ghi `categoryStatus`.
  - `name` 1–150 ký tự; `brand` 1–50; `price` số nguyên 1 … 1.000.000.000; `stock` 0 … 9999; `description` 1–1000; `status` `ACTIVE` hoặc `INACTIVE`.
  - `imageUrl` không bắt buộc, `https://`, tối đa 500 ký tự.
  - `specs` tối đa 20 cặp; khoá phải thuộc danh sách thông số của loại (`SPEC_ORDER`, bảng web dùng để xếp thông số); giá trị là chuỗi 1–100 ký tự.
  - Chuỗi bỏ khoảng trắng hai đầu trước khi kiểm. Trùng tên được phép.
- BR-12: Sửa mọi trường trừ `category` (đổi loại thì thêm món mới rồi xoá món cũ):
  - Body bắt buộc kèm `updatedAt` admin đang thấy; khác bản trong bảng → 409 `PRODUCT_CHANGED` kèm bản mới (`current`).
  - Đổi `stock` thì kèm `expectedStock` (tồn kho lúc mở form); khác tồn kho hiện tại (vd. khách vừa đặt hàng) → 409 `STOCK_CHANGED` kèm `currentStock`.
  - Món đã xoá mềm → 404 (khôi phục trước).
- BR-13: Ẩn, hiện lại là sửa `status`; `categoryStatus` đổi cùng trong một lần ghi. Món ẩn không hiện với khách (BR-04), không thêm vào giỏ được (cart `PRODUCT_UNAVAILABLE`).
- BR-14: Xoá là **xoá mềm**:
  - `status` thành `INACTIVE`, ghi `deletedAt`, `categoryStatus` thành `<loại>#DELETED`.
  - Khách thấy như món ẩn. Admin chỉ thấy ở lọc "Đã xoá".
  - Khôi phục: bỏ `deletedAt`, về trạng thái đã ẩn (`<loại>#INACTIVE`); muốn bán lại thì hiện lại (BR-13).
  - Không xoá hẳn khỏi bảng: seed prod (`sync-content`) sẽ tạo lại món demo nếu thiếu, và đơn cũ trỏ tới `productId`.
- BR-15: Thay đổi hiện ở cửa hàng chậm tối đa 60 giây (cache CloudFront và cache trong Lambda catalog).
- BR-16: Admin tải ảnh sản phẩm từ máy (#560, chốt 25/11/2026):
  - Chỉ nhóm `admin` (như BR-09). Tệp JPG/JPEG, PNG hoặc WebP; tối đa 3 MB. Không nhận SVG, GIF.
  - Web xin vé `POST /api/v1/admin/product-images` (khai loại và cỡ), rồi trình duyệt gửi tệp thẳng lên bucket ảnh riêng của shop bằng presigned POST. Vé sống 300 giây; S3 tự từ chối tệp rỗng, quá 3 MB hoặc khác loại đã khai.
  - Tên tệp do server sinh (`products/<ULID>.<jpg|png|webp>`), không dùng tên tệp trên máy admin, không ghi đè ảnh có sẵn.
  - Ảnh phục vụ qua CloudFront của shop; `imageUrl` là đường dẫn https đầy đủ cùng tên miền shop, `https://<tên miền shop>/images/products/<ULID>.<đuôi>` (vẫn là `https://` như BR-11).
  - Admin chịu trách nhiệm ảnh có quyền dùng (site và repo công khai).
  - Bỏ ảnh vừa chọn (nút X ở web) chỉ bỏ khỏi form, không xoá tệp đã tải.

### Giới hạn đã biết

- Seed dev, staging (`overwrite`) ghi đè món demo mỗi khi `products.json` đổi: sửa của admin trên món demo ở hai môi trường này có thể mất. Món admin tự thêm không bị đụng. Prod (`sync-content`) bỏ qua món đã sửa sau file hoặc đã xoá (dynamodb-design.md).
- Bấm lưu hai lần có thể tạo hai món (API thêm không có `Idempotency-Key`); web khoá nút khi đang gửi.
- Ảnh tải lên mà không dùng (bỏ bằng nút X, thay ảnh khác, sản phẩm không lưu) chưa tự xoá khỏi bucket; dọn bằng lifecycle hoặc job sau. Ảnh không tự thu nhỏ hay đổi sang WebP.

### Log

Ghi `adminId` (sub), `productId`, hành động (`CREATE`, `UPDATE`, `HIDE`, `SHOW`, `DELETE`, `RESTORE`; xin vé tải ảnh là `UPLOAD_IMAGE` kèm khoá ảnh thay cho `productId`). Không ghi mô tả, thông số hay toàn bộ body.

### Tiêu chí nghiệm thu

- Given không có token, When gọi `GET /api/v1/admin/products?category=gpu`, Then 401.
- Given khách thường đã đăng nhập, When gọi bất kỳ API admin sản phẩm, Then 403 `FORBIDDEN`.
- Given loại `gpu` có 7 món đang bán, 1 món ẩn, 0 món đã xoá, When admin gọi danh sách không `status`, Then trả 8 món mới nhất trước và `counts` = `{ active: 7, inactive: 1, deleted: 0 }`.
- Given thiếu `category`, When gọi danh sách, Then 400.
- Given `q=rtx`, When gọi danh sách loại `gpu`, Then chỉ trả món có "rtx" trong tên; `counts` không đổi.
- Given body hợp lệ, When admin `POST /api/v1/admin/products`, Then 201, header `Location`, `productId` là ULID mới, `createdAt` = `updatedAt`; trong 60 giây món hiện ở `/products?category=<loại>` nếu `ACTIVE`.
- Given `price = 0` hoặc khoá `specs` không thuộc loại, When thêm, Then 400 kèm `errors` theo trường.
- Given admin mở form lúc `updatedAt = T1`, người khác đã sửa thành `T2`, When gửi `PATCH` với `updatedAt = T1`, Then 409 `PRODUCT_CHANGED` kèm bản mới, không ghi gì.
- Given admin thấy `stock = 12`, khách vừa đặt 2 món, When gửi `PATCH` `{ stock: 20, expectedStock: 12 }`, Then 409 `STOCK_CHANGED` kèm `currentStock = 10`, không ghi gì.
- Given món đang bán, When `PATCH { status: INACTIVE }`, Then `GET /api/v1/products/{id}` trả 404 sau tối đa 60 giây; danh sách admin lọc "Đã ẩn" có món đó.
- Given món đang bán, When `DELETE`, Then 204; danh sách admin mặc định không còn món đó, lọc `DELETED` có, khách nhận 404; đơn cũ có món đó vẫn xem được.
- Given món đã xoá, When `POST .../restore`, Then 200, `status = INACTIVE`, không có `deletedAt`.
- Given món đã xoá, When `PATCH` hoặc `DELETE` lần nữa, Then 404.
- Given prod chạy seed `sync-content` sau khi admin sửa giá hoặc xoá một món demo, When deploy, Then món đó giữ bản của admin (không bị ghi lại, không được tạo lại).
- Given admin, When `POST /api/v1/admin/product-images` với `{ contentType: image/webp, size: 524288 }`, Then 200 kèm `upload.url`, `upload.fields`, `imageUrl` `https://<tên miền shop>/images/products/<ULID>.webp`, `expiresAt` sau 300 giây; hai lần xin cho ra hai đường dẫn khác nhau.
- Given `contentType` `image/svg+xml`, hoặc `size` 0, hoặc `size` 3.145.729, When xin vé, Then 400, không cấp vé.
- Given khách thường hoặc không có token, When xin vé, Then 403 hoặc 401.
- Given vé hợp lệ, When trình duyệt gửi tệp 4 MB hoặc khác loại đã khai, Then S3 từ chối (thử tay trên dev sau khi có hạ tầng #561).

## Cách hiện thực tìm kiếm (quyết định 03/10/2026, chờ An đồng ý)

DynamoDB không có tìm kiếm toàn văn. Dịch vụ tìm kiếm như OpenSearch tính tiền theo giờ, vượt ngân sách dự án. Với quy mô demo (khoảng 100 sản phẩm):

- Tên sản phẩm được chuẩn hoá (chữ thường, bỏ dấu, gộp khoảng trắng) một lần khi Lambda nạp danh sách vào bộ nhớ, không cần lưu thêm cột trong bảng. Từ khoá `q` cũng chuẩn hoá theo cùng cách.
- Lambda `catalog` giữ danh sách sản phẩm ACTIVE trong bộ nhớ 60 giây (khởi tạo ngoài handler). Hết hạn thì nạp lại bằng Query trên GSI `byCategory`, mỗi loại một lần, chạy song song. Không dùng Scan.
- Lọc `q` bằng "tên chuẩn hoá chứa `q` chuẩn hoá", sắp xếp theo BR-08 và phân trang trên mảng trong bộ nhớ. Cursor lưu vị trí của sản phẩm cuối trang (còn hay hết hàng, giá hoặc `createdAt`, `productId`), nên vẫn đúng khi danh sách nạp lại giữa hai trang.
- CloudFront cache mỗi URL 60 giây.

Giới hạn đã biết: cách này chỉ hợp khi catalog nhỏ (vài nghìn sản phẩm trở xuống). Hướng mở rộng là OpenSearch hoặc bảng từ khoá.
