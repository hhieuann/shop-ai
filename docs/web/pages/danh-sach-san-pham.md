# Danh sách và kết quả tìm kiếm `/products`

Code: `features/catalog/pages/ProductListPage.tsx`, `features/catalog/lib/productFilters.ts`. Nghiệp vụ: `docs/business/catalog.md` (BR-01, BR-02, BR-03, BR-08). Đọc kèm [design-system.md](../design-system.md).

Một trang cho cả ba trường hợp: xem tất cả, xem theo loại hàng, xem kết quả tìm kiếm.

## 1. Đường dẫn và dữ liệu

- **URL là nguồn sự thật** của bộ lọc: `/products?q=rtx&category=gpu&sort=price_asc`. Chia sẻ link và F5 không mất. Tham số rỗng hoặc mặc định thì xoá khỏi URL.
- `q`: từ khoá **nhập ở ô tìm kiếm trên header** (không có ô tìm riêng trong trang), 1–30 ký tự sau khi bỏ khoảng trắng; rỗng thì không gửi.
- `category`: 1 trong 13 loại (`CATEGORIES`). Giá trị lạ trên URL bị bỏ qua.
- `sort`: `newest` (mặc định, không ghi lên URL), `price_asc`, `price_desc`. Hết hàng luôn nằm cuối (server lo).
- `GET /api/v1/products` trả 20 sản phẩm mỗi lần kèm `nextCursor`; trang dùng `useInfiniteQuery`. **API không trả tổng số kết quả**, nên giao diện không hiện "x / y sản phẩm".

## 2. Bố cục

Không có cột bộ lọc bên trái (chỉ có lọc theo loại). Toàn bộ nằm trong khung chung `--content-max`, lề `--gutter`.

```
┌ Thanh công cụ ──────────────────────────────────────────────────────┐
│ H1 tiêu đề (+ dòng phạm vi)                     [Loại ▾] [Sắp xếp ▾] │
└──────────────────────────────────────────────────────────────────────┘
Lưới ProductCard (tự chia cột)
                         [ Xem thêm sản phẩm ]
```

| Phần | Giá trị |
|---|---|
| Trang | padding trên 8px (cộng 16px của `<main>`) |
| Thanh công cụ | `display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:24px` |
| Lưới | `display:grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap:16px`; từ 960px `minmax(208px, 1fr)`; `<ul>` bỏ kiểu danh sách |
| Xem thêm | căn giữa, cách lưới 24px |

Số cột thực tế (nội dung trừ lề): 390px → 2 cột; 1366px → 5 cột; 1920px → 8 cột.

## 3. Các khối

### 3.1 Tiêu đề
`<h1>` 24/32/600, nội dung theo trường hợp:
| Trường hợp | Tiêu đề | Dòng phạm vi (14/20 `--fg-subdued`, cách 2px) |
|---|---|---|
| Có `q` | Kết quả cho “rtx” (ngoặc kép cong) | "Trong mục Card đồ hoạ" nếu có thêm `category` |
| Chỉ có `category` | Tên loại ("Card đồ hoạ") | — |
| Không có gì | Tất cả sản phẩm | — |

Loại đang xem cũng được đánh dấu trên hàng chip của header (`aria-current="page"`).

### 3.2 Bộ lọc và sắp xếp
Hai `<label>` bọc select, xếp ngang, gap 12px, tự xuống dòng khi hẹp.
- Nhãn phía trên, 12/18 `--fg-subdued`, cách 4px: "Loại", "Sắp xếp".
- Select cao 40px, rộng tối thiểu 160px, padding `0 12px`, kiểu ô nhập chung (design-system §9.4).
- Lựa chọn "Loại": "Tất cả loại" + 13 loại. Lựa chọn "Sắp xếp": **Mới nhất**, **Giá tăng dần**, **Giá giảm dần** (đúng 3 giá trị của BR-08).
- Đổi lựa chọn → cập nhật URL ngay, không có nút "Áp dụng".

### 3.3 Lưới sản phẩm
`ProductCard` cho mỗi sản phẩm, mỗi thẻ trong một `<li>`. Không có nút thêm vào giỏ, so sánh hay đánh giá trên thẻ.

### 3.4 Xem thêm
Hiện khi còn `nextCursor`. Nút phụ cỡ `md`: cao 40px, padding `8px 24px`, chữ "Xem thêm sản phẩm"; đang tải trang tiếp → "Đang tải…" và vô hiệu. Không hiện số lượng.

## 4. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Tải lần đầu | dòng "Đang tải sản phẩm…" `--fg-subdued` |
| Đổi bộ lọc | giữ kết quả cũ (`keepPreviousData`), lưới opacity .6 và `aria-busy="true"` tới khi có kết quả mới |
| Lỗi | "Chưa tải được sản phẩm. Tải lại trang để thử lần nữa." `role="alert"` |
| Không có kết quả tìm kiếm | `EmptyState`: "Không có sản phẩm nào có “{q}” trong tên." + link "Xem tất cả sản phẩm" |
| Loại hàng chưa có sản phẩm | `EmptyState`: "Mục này chưa có sản phẩm." + link "Xem tất cả sản phẩm" |
| Sản phẩm hết hàng | vẫn hiện, nằm cuối, `StockBadge` "Hết hàng", ô ảnh mờ .6 |

`EmptyState`: nền `--bg-surface`, viền `--border-divider`, bo 16px, padding `40px 16px`, căn giữa, khoảng cách giữa câu và link 8px.

Lưu ý dữ liệu có thể trễ tới 60 giây (cache): tên vừa đổi có thể chưa tìm thấy, "còn hàng" có thể vừa hết. Giao diện không cần báo; lúc đặt hàng server kiểm lại.

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| 390px | Tiêu đề và hai select xếp thành 2 hàng (flex-wrap); select chia đôi bề ngang hoặc xuống dòng; lưới 2 cột; nút Xem thêm giữ cỡ |
| 1366px | Tiêu đề trái, select phải cùng hàng; lưới khoảng 5 cột |
| 1920px | Như 1366, khoảng 8 cột |

## 6. Trợ năng
- Một `<h1>` hiển thị (tiêu đề trang).
- Select có nhãn bằng `<label>` bọc ngoài.
- Lưới là `<ul>`; `aria-busy` khi đang tải lại.
- Lỗi dùng `role="alert"`.
- *(Nên thêm)* đọc thông báo khi kết quả thay đổi: một vùng `aria-live="polite"` ẩn, nội dung "Đã hiện N sản phẩm".

## 7. Việc còn lại
- Tách `EmptyState` thành component dùng chung (giỏ hàng rỗng, chưa có đơn hàng dùng lại).
- Thêm vùng `aria-live` ở mục 6.
