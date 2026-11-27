# Trang Nguồn ảnh

Chốt 27/11/2026 (#530). Nhóm đồng ý dùng ảnh chính thức của nhà sản xuất cho 104 sản phẩm demo, với điều kiện ghi rõ ảnh thuộc về nhà sản xuất và chỉ dùng minh hoạ cho dự án học tập.

## 1. Đường dẫn và dữ liệu

- `/image-credits`, nền trắng như trang danh sách (`handle.surface = 'plain'`). Link "Nguồn ảnh" ở dòng cuối footer (design-system §9.2).
- Dữ liệu tĩnh ở web: `features/catalog/lib/productImages.ts` (`PRODUCT_IMAGE_CREDITS`: mã, tên, loại, hãng, trang sản phẩm của hãng nếu có), sinh bằng script từ seed và bảng nguồn ảnh của nhóm. Không gọi API.
- Ảnh: `apps/web/public/product-images/<productId>.webp`. Không đổi API, contract, seed: web tự gắn ảnh theo `productId` khi API không có `imageUrl` (design-system §9.34).

## 2. Bố cục

- `Breadcrumb` Trang chủ › Nguồn ảnh; H1 "Nguồn ảnh sản phẩm".
- Khối ghi chú nền `--bg-subtle`, bo `--radius-lg`:
  - "Ảnh sản phẩm trên trang thuộc về nhà sản xuất của từng sản phẩm, chỉ dùng minh hoạ cho dự án học tập (chương trình First Cloud AI Journey 2026). Sản phẩm, giá và tồn kho là dữ liệu demo, shop không bán hàng thật."
  - "Chúng tôi sẽ gỡ ảnh nếu nhà sản xuất hoặc chủ sở hữu ảnh yêu cầu."
- Danh sách 104 dòng trong khung viền `--border-divider`, bo `--radius-xl`, rộng tối đa 960px; mỗi dòng: ảnh nhỏ 56px (ô `--bg-subtle`), tên sản phẩm 600 `--fg-heading`, dòng phụ `--fg-muted` "Ảnh thuộc về {hãng}" và, nếu có, link "Trang sản phẩm của hãng" (mở thẻ mới, icon `ExternalLink`).
- Không nhắc trang dùng để tìm ảnh.

## 3. Trạng thái

Dữ liệu tĩnh nên không có trạng thái tải. Ảnh nhỏ lỗi thì hiện `CategoryIcon` của loại hàng.

## 4. Trợ năng

- `document.title` "Nguồn ảnh sản phẩm | Black Magic".
- Link ngoài có `rel="noopener noreferrer"` và chữ ẩn "(mở thẻ mới)" cho trình đọc màn hình.
