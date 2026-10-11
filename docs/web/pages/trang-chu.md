# Trang chủ `/`

Code: `features/home/pages/HomePage.tsx`, `features/home/components/ProductRail.tsx`. Đọc kèm [design-system.md](../design-system.md); file này chỉ mô tả bố cục và khối riêng của trang.

Chốt ngày 11/10/2026 theo bản mẫu trang chủ đã duyệt (**bản 9**). Bố cục theo trang tham khảo chính, màu chàm, giữ 3 nút header của bản trước; **ô tìm kiếm dạng viên thuốc và hàng sản phẩm không khung theo ảnh tham khảo của Hoàng**. Spec này là cho khách **chưa đăng nhập**; khác biệt khi đã đăng nhập ở mục 7.

## 1. Mục đích và dữ liệu

- Dẫn khách tới đúng loại hàng nhanh nhất (menu 13 loại, 6 link mua theo nhu cầu) và giới thiệu điểm khác biệt của Black Magic: **gợi ý món thường mua kèm** (project-plan).
- Dữ liệu:
  - Mỗi dải sản phẩm: `GET /api/v1/products` theo bộ lọc của dải, trang đầu, `limit=12`.
  - Khối "Đang được mua nhiều": widget gợi ý của An, `GET /api/v1/recs` (khách chưa đăng nhập nhận **hàng bán chạy theo loại**, ADR-0016, recommendation.md §2.3).
- Không có banner khuyến mãi, flash sale, đếm ngược, tin tức (ngoài phạm vi MVP).

## 2. Bố cục

Nền trang `--bg-canvas` (`#F5F5F5`). Nội dung trong khung `--content-max` 1920px, lề `--gutter`.

```
Header hàng 1 (chàm 76)  Logo ······ [Danh mục] (Ô tìm viên thuốc ≤720  ●) ······ Đơn hàng · Đăng nhập ▾ │ Giỏ
Header hàng 2 (trắng 56)        Hàng mới về · Chơi game · Làm văn phòng · Học lập trình · Thiết kế, dựng phim · Tất cả sản phẩm   (cụm căn giữa)
┌ Menu danh mục 300 ┐┌ Hero (gradient chàm) ───────────────────┐┌ Thường mua kèm 400 ┐
│ 13 loại hàng      ││                                          ││ Card đồ hoạ + Nguồn │
│                   │└──────────────────────────────────────────┘│ CPU + Main + RAM    │
│                   │┌ Giao hàng miễn phí ┐┌ Chưa có tài khoản? ┐│ Laptop + Chuột+Balo │
└───────────────────┘└────────────────────┘└────────────────────┘└─────────────────────┘
Đang được mua nhiều                                     (7 thẻ trên nền trang, không khung, ›)
Hàng mới về                                                         Xem tất cả
Card đồ hoạ                                                         Xem tất cả
Laptop                                                              Xem tất cả
Footer (chàm)
```

| Phần | Giá trị |
|---|---|
| Hàng đầu trang | padding `32px` trên, `8px` dưới; lưới `grid-template-columns: 300px minmax(0,1fr) 400px; gap: 8px` |
| Cột giữa | lưới 2 hàng `minmax(340px, auto) auto`, gap 8px: hero ở trên, 2 ô thông tin ở dưới (`1fr 1fr`, gap 8px) |
| Cột phải | 3 ô "Thường mua kèm" chia đều chiều cao (`grid-template-rows: repeat(3, 1fr)`, gap 8px) |
| Các khối sản phẩm | không khung; mỗi khối padding trên 24px, dưới 4px; tiêu đề cách hàng thẻ 16px |
| Footer | cách khối cuối 32px (design-system §9.2) |

## 3. Các khối

### 3.1 Menu danh mục (cột trái)
`CategoryMenu` dạng luôn hiện (design-system §9.18): 13 loại hàng, khung rộng 300px. Chiều cao theo nội dung (13 × 36 + 16 = 484px); hai cột kia kéo theo chiều cao này.

### 3.2 Hero
`<section aria-labelledby="hero-t">`, chỗ **duy nhất** của trang dùng `--gradient-brand`.

| Phần | Giá trị |
|---|---|
| Khung | bo **12px**, padding `40px 56px`, chữ trắng, `overflow:hidden`; `flex`, căn giữa dọc, `justify-content: space-between`, gap 24px |
| Nhãn nhỏ | icon `Sparkles` 14 + "Gợi ý mua kèm", 13/18/600, nền trắng 14%, viền trắng 28%, bo tròn, padding `4px 10px` |
| Tiêu đề `<h2>` | **"Mua card đồ hoạ, xem luôn món thường mua kèm"**, 28/36/700, cách nhãn 12px, khối chữ rộng tối đa 520px |
| Đoạn văn | "Mỗi trang sản phẩm có dải "Thường mua kèm", tính từ các đơn hàng trước." 16/24, trắng 88%, cách 12px |
| Nút | cách 24px, gap 8px: "Xem card đồ hoạ" (`on-gradient`: nền trắng, chữ `--hero-ink`) → `/products?category=gpu`; "Xem tất cả sản phẩm" (`on-gradient-outline`) → `/products`. Cao 44px, padding `0 20px`, bo 10px, 16/24/600 |
| Minh hoạ | `aria-hidden`, bên phải: ô card đồ hoạ + dấu "+" + ô bộ nguồn. Ô 120×120, bo 16px, nền `rgba(30,27,75,.35)`, viền trắng 24%, icon `Gpu` / `PlugZap` 60; dấu "+" 28 trắng 70% |

Câu tiêu đề cũ "…biết luôn nên lắp nguồn nào" bỏ vì nghe như tư vấn tương thích linh kiện (catalog BR-06).

### 3.3 Hai ô thông tin (dưới hero)
Ô nền `--bg-surface`, viền 1px `--border-divider`, bo 12px, padding `16px 20px`, `flex` gap 14px: ô icon 40×40 nền `--bg-primary-tint-2` bo 8px, icon 24 `--fg-primary`; tiêu đề `<h3>` 16/22/600 `--fg-heading`; mô tả 14/20 `--fg-muted`, cách 4px.

| Ô | Icon | Tiêu đề | Mô tả | Link |
|---|---|---|---|---|
| 1 | `Truck` | Giao hàng miễn phí mọi đơn | Thanh toán khi nhận hàng (COD). | — |
| 2 | `UserRound` | Chưa có tài khoản? | Giỏ hàng lưu theo tài khoản và theo dõi được đơn. | "Tạo tài khoản ›" 14/20/600 `--fg-primary` → `/register` (mang `state.from: '/'`) |

Nội dung lấy từ nghiệp vụ (ordering BR-05, BR-06; account.md; cart.md BR-10). Trang tham khảo đặt banner khuyến mãi ở chỗ này.

### 3.4 Ba ô "Thường mua kèm" (cột phải)
Mỗi ô là một link: nền `--bg-surface`, viền 1px `--border-divider`, bo 12px, padding 16px, `flex-direction: column; justify-content: space-between`, gap 10px. Hover: viền `--border-default` + `--shadow-card-hover`.
- Hàng icon: các ô 36×36 nền `--bg-primary-tint-2` bo 8px, icon 22 `--fg-primary`, nối bằng dấu `Plus` 14 `--fg-icon-soft`, gap 6px.
- Tiêu đề `<h3>` 15/20/600 `--fg-heading`; mô tả 13/18 `--fg-muted`, cách 2px.

| Ô | Icon | Tiêu đề | Mô tả | Tới |
|---|---|---|---|---|
| 1 | `Gpu` + `PlugZap` | Card đồ hoạ + Nguồn | RTX 4070 Super cần nguồn từ 750W | `/products?category=psu` |
| 2 | `Cpu` + `CircuitBoard` + `MemoryStick` | CPU + Mainboard + RAM | Cùng socket AM5 hoặc LGA1700, cùng chuẩn DDR | `/products?category=mainboard` |
| 3 | `Laptop` + `Mouse` + `Backpack` | Laptop + Chuột + Balo | Bộ đi học, đi làm thường mua cùng | `/products?category=mouse` |

Các cặp lấy từ bộ dữ liệu demo (`nguon_de_xuat` của GPU, `socket` của CPU/mainboard, catalog.md). Câu mô tả chỉ nêu thông số có trong `specs`, không khẳng định "tương thích".

### 3.5 Khối sản phẩm
Mỗi khối là `StoryBlock` + `Carousel` + `ProductCard` theo design-system §9.9–9.11: **không khung**, tiêu đề 24/32/700 trên nền trang, "Xem tất cả" màu chàm ở mép phải; thẻ trắng bo 12px, ô ảnh vuông chạm mép, tên một dòng, giá và nhãn tồn kho cùng hàng; 7 thẻ mỗi hàng từ 1600px, 6 thẻ từ 1280px, nút mũi tên kính 42px khi còn thẻ.

| Thứ tự | Tiêu đề | "Xem tất cả" | Dữ liệu |
|---|---|---|---|
| 1 | Đang được mua nhiều | không | widget gợi ý của An (mục 3.6) |
| 2 | Hàng mới về | `/products` | `GET /products?sort=newest` |
| 3 | Card đồ hoạ | `/products?category=gpu` | `GET /products?category=gpu` |
| 4 | Laptop | `/products?category=laptop` | `GET /products?category=laptop` |

Dòng phụ cạnh tiêu đề của bản 6 ("Hàng bán chạy theo từng loại", "Xem nguồn thường mua kèm ở trang sản phẩm") bỏ ở bản 9.

- Lấy 12 sản phẩm đầu; hàng hết nằm cuối (catalog BR-08).
- Đang tải: 7 khung chờ cao 360px (design-system §9.12). Lỗi: "Chưa tải được sản phẩm. Tải lại trang để thử lần nữa." Rỗng: "Chưa có sản phẩm nào trong mục này." (14/20 `--fg-muted`).

### 3.6 Widget "Đang được mua nhiều" (An làm)
Đặt **ngay dưới hàng đầu trang**, là khối sản phẩm đầu tiên. Dùng đúng `StoryBlock` + `Carousel` + `ProductCard`, không CSS riêng. Khách chưa đăng nhập hoặc chưa có dữ liệu → hàng bán chạy theo loại (baseline). API không trả gì → ẩn khối, không để khối rỗng.

## 4. Responsive

| Màn | Khác biệt |
|---|---|
| ≥1600 | Như mục 2; 7 thẻ mỗi hàng |
| 1280–1599 | Như mục 2; 6 thẻ mỗi hàng |
| 768–1279 | Header bản điện thoại (design-system §9.1). Hàng đầu trang một cột: không có menu danh mục (mở bằng nút menu); hero → 2 ô thông tin xếp dọc → 3 ô "Thường mua kèm" thành **dải cuộn ngang**, mỗi ô rộng 260px. Khối sản phẩm: dải cuộn ngang, thẻ 220px |
| <768 (390px) | Như trên; hero padding 24px, tiêu đề 24/32, đoạn văn 14/20, nút xuống dòng, **ẩn minh hoạ**. Khối sản phẩm: tiêu đề 20/28, "Xem tất cả" 14/20 vẫn ở mép phải; lưới **2 cột** gap 12px, **4 thẻ đầu**; tên thẻ 12/18, giá 15/22, giá và nhãn xếp dọc. Ô tìm viên thuốc cao 44px dưới hàng 1 |

## 5. Trợ năng
- `<h1 class="sr-only">Black Magic: laptop và linh kiện PC</h1>`; mỗi khối có `<h2>` hiển thị (`aria-labelledby`).
- Menu danh mục là `<nav aria-label="Danh mục">`; hàng 2 header là `<nav aria-label="Mua theo nhu cầu">`.
- Minh hoạ hero và mọi icon cạnh chữ `aria-hidden`.
- Ô "Thường mua kèm" là link, tên đọc được là tiêu đề + mô tả.
- Giá có bản đọc "… đồng" (`Price`).

## 6. Ngoài phạm vi
Banner khuyến mãi và dải banner nhỏ, chấm phân trang banner, flash sale, giá gốc, nhãn "-%", ô "Mua kèm giá ưu đãi", ô quà tặng, nút lọc dòng máy trong khối (PC I3, I5…), khối tin tức, nút chat nổi. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md).

## 7. Khi đã đăng nhập (chưa thiết kế chi tiết)
- Khối 1 đổi tiêu đề thành **"Dành cho bạn"**, dòng phụ "Dựa trên các món bạn đã xem" (widget của An).
- Ô thông tin 2 "Chưa có tài khoản?" không còn hợp; cần chọn nội dung thay. Chưa chốt: làm khi thiết kế trang chủ lúc đã đăng nhập.

## 8. Việc còn lại
- Thiết kế trang chủ khi đã đăng nhập (mục 7).
- Code chưa đổi bố cục: `HomePage.tsx`, `ProductRail.tsx`, `ProductCard` vẫn theo bản cũ (màu đã chàm từ `tokens.css`). Sửa theo spec này.
- Bộ dữ liệu demo chưa có ảnh sản phẩm: thẻ hiện icon loại hàng trên ô xám.
