# Trang chủ `/`

Code: `features/home/pages/HomePage.tsx`, `features/home/components/ProductRail.tsx`. Đọc kèm [design-system.md](../design-system.md); file này chỉ mô tả bố cục và khối riêng của trang.

## 1. Mục đích và dữ liệu

- Dẫn khách tới đúng loại hàng nhanh nhất (theo nhu cầu, theo danh mục) và giới thiệu điểm khác biệt của Black Magic: **gợi ý món đi kèm** (project-plan).
- Dữ liệu: `GET /api/v1/products` (trang đầu, `limit=12`) cho mỗi dải sản phẩm; widget gợi ý "Dành cho bạn" của An gọi `GET /api/v1/recs`.
- Không có banner quảng cáo, đếm ngược hay ưu đãi (ngoài phạm vi MVP).

## 2. Bố cục

Nền trang `--bg-canvas`. Các khối xếp dọc, **cách nhau 16px**, mỗi khối là một `StoryBlock` (nền `--bg-surface`, bo 16px, viền 1px) trừ hero.

```
<h1 class="sr-only">Black Magic: laptop và linh kiện PC</h1>
┌──────────── Hàng 1 (≥960: 7/12 + 5/12, cao bằng nhau) ────────────┐
│ Hero (gradient thương hiệu)          │ StoryBlock "Mua theo nhu cầu" │
└──────────────────────────────────────┴───────────────────────────────┘
StoryBlock "Danh mục"            (carousel 13 ô loại hàng, căn giữa)
[Widget "Dành cho bạn" của An]   (StoryBlock + Carousel + ProductCard)
ProductRail "Hàng mới về"        → Xem tất cả: /products
ProductRail "Card đồ hoạ"        → /products?category=gpu
ProductRail "Laptop"             → /products?category=laptop
```

| Kích thước màn hình | Hàng 1 |
|---|---|
| < 960px | Hero và "Mua theo nhu cầu" xếp chồng, mỗi khối rộng 100% |
| ≥ 960px | `flex-direction: row; align-items: stretch`; hero `flex: 0 1 58.333%`, khối nhu cầu `flex: 1`; khoảng cách 16px |

## 3. Các khối

### 3.1 Hero
Chỗ **duy nhất** của trang dùng `--gradient-brand`.

| Phần | Giá trị |
|---|---|
| Khung | `<section aria-labelledby="hero-title">`, bo 16px, padding 24px (≥640: 40px), chữ trắng, `overflow:hidden` |
| Bố cục | < 640: chữ trên, minh hoạ dưới (cột, gap 24); ≥ 640: hàng ngang, căn giữa dọc |
| Chữ | khối chữ rộng tối đa 560px |
| Tiêu đề `<h2>` | 32/44/600 → **44/56** từ 1280px |
| Đoạn văn | 16/24, trắng 88%, cách tiêu đề 12px |
| Nút | cách 24px, gap 8px, tự xuống dòng. Nút chính **trắng chữ `#2E1065`** (tím trên tím sẽ chìm), nút phụ viền trắng 40%; cả hai cao 48px, padding `8px 24px`, bo 8px, đậm 600 (`on-gradient`, `on-gradient-outline` trong design-system §9.3) |
| Minh hoạ | `aria-hidden`: ô GPU + dấu "+" + ô bộ nguồn, nói đúng câu chuyện "mua kèm" của dự án. Ô 104×104 (điện thoại 72×72), bo 16px, nền `rgba(11,11,15,.35)`, viền `rgba(255,255,255,.22)`, icon 56px (điện thoại 36px); dấu "+" 32px đậm 300, trắng 70% |
| Focus | viền focus màu trắng bên trong hero |

Nội dung hiện tại: tiêu đề "Mua card đồ hoạ, biết luôn nên lắp nguồn nào"; nút "Xem card đồ hoạ" → `/products?category=gpu`, "Xem tất cả sản phẩm" → `/products`.

### 3.2 Mua theo nhu cầu
`StoryBlock` tiêu đề "Mua theo nhu cầu", 4 ô ứng với 4 nhóm khách trong project-plan, mỗi ô dẫn tới loại hàng nhóm đó hay mua:

| Ô | Mô tả | Link |
|---|---|---|
| Chơi game | Card đồ hoạ, màn hình tần số quét cao, bàn phím cơ | `?category=gpu` |
| Làm văn phòng | Laptop mỏng nhẹ, chuột, balo, hub USB-C | `?category=laptop` |
| Học lập trình | Nâng RAM, SSD, thêm màn hình phụ | `?category=ram` |
| Thiết kế, dựng phim | Màn hình màu chuẩn, ổ cứng lớn, tản nhiệt | `?category=monitor` |

- Lưới: 1 cột (<640), 2 cột (≥640); từ 960px chia 2 hàng bằng nhau để khối cao bằng hero. Gap 8px; padding `0 16px 16px` (≥640: `0 24px 24px`).
- Ô: link `flex`, gap 12px, padding 16px, cao 100%, nền `--bg-surface-raised`, viền `--border-divider`, bo 8px. Icon lucide 24px (`strokeWidth 1.75`) màu `--fg-primary`; tiêu đề 16/24/600; mô tả `--fg-subdued`, cách 2px. Hover: viền `--border-primary`.

### 3.3 Danh mục
`StoryBlock` "Danh mục" chứa `Carousel centered` gồm 13 ô loại hàng (`CATEGORIES`, cùng thứ tự với chip trên header).
- Ô: link cột, gap 8px, rộng 104px, chữ căn giữa.
- Vòng tròn 96px nền `--bg-surface-raised`, viền `--border-default`, icon `CategoryIcon` 32px màu `--fg-muted`. Không dùng ảnh sản phẩm.
- Nhãn đậm 500, `min-height: 40px` (giữ chỗ 2 dòng).
- Hover: viền và icon chuyển `--border-primary` / `--fg-primary`.

### 3.4 Dải sản phẩm (`ProductRail`)
`StoryBlock` (tiêu đề, phụ đề tuỳ chọn, link "Xem tất cả" tới trang danh sách cùng bộ lọc) + `Carousel` + `ProductCard`.
- Lấy 12 sản phẩm đầu của `GET /products` theo bộ lọc của dải; thứ tự mặc định là mới nhất (hết hàng nằm cuối, BR-08).
- Đang tải: 6 khung chờ cao 300px. Lỗi: "Chưa tải được sản phẩm. Tải lại trang để thử lần nữa." Rỗng: "Chưa có sản phẩm nào trong mục này." (padding `0 24px 24px`, `--fg-subdued`).
- Dải hiện có: "Hàng mới về", "Card đồ hoạ" (phụ đề "Nhớ xem gợi ý bộ nguồn đi kèm ở trang sản phẩm"), "Laptop".

### 3.5 Widget gợi ý "Dành cho bạn" (An làm)
Đặt **ngay dưới "Danh mục"**. Dùng đúng `StoryBlock` + `Carousel` + `ProductCard` như `ProductRail`, không CSS riêng. Phụ đề gợi ý: lý do gợi ý ngắn gọn (ví dụ "Dựa trên các món bạn đã xem"). Khách chưa đăng nhập hoặc chưa có dữ liệu → hiện **hàng bán chạy theo loại** (baseline, ADR-0016), phụ đề đổi thành "Đang được mua nhiều". API không trả gì → ẩn khối, không để khối rỗng.

## 4. Responsive

| Màn | Khác biệt |
|---|---|
| 390px | Hàng 1 xếp chồng; hero padding 24, tiêu đề 32/44, minh hoạ 72px; ô nhu cầu 1 cột; carousel vuốt tay, không nút ‹ › |
| 1366px | Hàng 1 chia 7/12 + 5/12; tiêu đề hero 44/56 |
| 1920px | Như 1366, nội dung rộng tối đa 1920 trừ lề 64px mỗi bên |

## 5. Trợ năng
- `<h1>` ẩn, mỗi khối có `<h2>` hiển thị làm tên vùng (`aria-labelledby`).
- Minh hoạ hero `aria-hidden`; icon trong ô nhu cầu và danh mục `aria-hidden` (nhãn chữ đã đủ nghĩa).

## 6. Việc còn lại
- Thêm widget "Dành cho bạn" (An, Sprint 2, tuần 20–26/10).
- Câu hero "…biết luôn nên lắp nguồn nào" nghe như tư vấn tương thích linh kiện, mà dự án không làm (catalog BR-06). Gợi ý sửa trong code: "Mua card đồ hoạ, xem luôn món thường mua kèm".
