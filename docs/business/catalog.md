# Tính năng: Xem và tìm sản phẩm (Catalog)

- Module: catalog
- Vai trò: khách chưa đăng nhập, khách hàng
- Người viết: Hoàng · Ngày: 01/10/2026 · Sửa: 03/10/2026 (tìm kiếm, loại hàng, sắp xếp)

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

## Cách hiện thực tìm kiếm (quyết định 03/10/2026, chờ An đồng ý)

DynamoDB không có tìm kiếm toàn văn. Dịch vụ tìm kiếm như OpenSearch tính tiền theo giờ, vượt ngân sách dự án. Với quy mô demo (khoảng 100 sản phẩm):

- Khi ghi sản phẩm, lưu thêm `nameSearch`: tên đã chuyển chữ thường và bỏ dấu.
- Lambda `catalog` giữ danh sách sản phẩm ACTIVE trong bộ nhớ 60 giây (khởi tạo ngoài handler). Hết hạn thì nạp lại bằng Query trên GSI `byCategory`, mỗi loại một lần, chạy song song. Không dùng Scan.
- Lọc `q` bằng `nameSearch.includes(q chuẩn hoá)`, sắp xếp theo BR-08 và phân trang trên mảng trong bộ nhớ.
- CloudFront cache mỗi URL 60 giây.

Giới hạn đã biết: cách này chỉ hợp khi catalog nhỏ (vài nghìn sản phẩm trở xuống). Hướng mở rộng là OpenSearch hoặc bảng từ khoá.
