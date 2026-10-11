# Design system: Black Magic

Người viết: Hoàng · Cập nhật: 11/10/2026 (bản mẫu trang chủ 9) · Áp dụng cho `apps/web`

Tài liệu đầy đủ của hệ giao diện. Bản tóm tắt ở [giao-dien.md](giao-dien.md), mục lục ở [README.md](README.md).

- **Phạm vi:** chỉ những gì có trong tài liệu dự án (`docs/business/`, `project-plan.md`). Những tính năng cửa hàng điện tử lớn thường có nhưng dự án **không làm** được liệt kê ở [ngoai-pham-vi.md](ngoai-pham-vi.md).
- **Giá trị:** sau khi code theo kịp, `tokens.css` và `base.css` là chuẩn; lệch thì sửa tài liệu. Trong đợt chuyển sang giao diện chàm, tài liệu này là chuẩn.
- **Đổi giao diện 11/10/2026:** bố cục theo một trang bán linh kiện máy tính trong nước làm tham khảo chính; màu chủ đạo đổi từ tím "Áo choàng phù thủy" sang **chàm**; font đổi sang **Inter**. Code đã đổi theo tài liệu này (token, font, header, menu danh mục, footer, thẻ sản phẩm, khối sản phẩm, trang chủ). Bản mẫu đã duyệt: trang chủ ([pages/trang-chu.md](pages/trang-chu.md)).
- **Lịch sử:** 06/10/2026 đổi từ nền tối "Midnight Violet" sang nền sáng tím (issue #49).
- **Đơn vị:** viết bằng px. Root font-size giữ mặc định của trình duyệt (16px).

---

## 1. Nguyên tắc

- **Bố cục theo trang tham khảo chính** (đổi ngày 11/10/2026): lấy cấu trúc, kích thước, cỡ chữ, bo góc, bóng. Nhóm nút bên phải header giữ như bản trước: nút **Đơn hàng**, nút và menu **Đăng nhập** (§9.17), icon **Giỏ hàng**. Không lấy nhận diện của trang nào.
- **Màu chủ đạo chàm** (indigo). Nền trang xám nhạt `#F5F5F5`, khối và thẻ trắng, chữ `#1A1A1A`. Không có giao diện tối.
- **Header và footer cùng màu chàm** `--bg-chrome` (`#4338CA`), chữ và icon trắng. Hàng thứ hai của header nền trắng.
- **Không ghi cứng mã màu trong component.** Chỉ dùng biến ngữ nghĩa `--bg-*`, `--fg-*`, `--border-*`. Chữ trên header, footer và hero dùng `--fg-on-chrome` (trắng).
- **Mỗi màu nhấn có một việc:**

  | Màu | Biến | Chỉ dùng cho |
  |---|---|---|
  | Chàm (`#4F46E5`, chữ chàm `#4338CA`) | `--bg-primary`, `--fg-primary`, `--border-primary` | Hành động và trạng thái đang chọn: nút chính, link, icon dẫn đường, mục đang chọn, focus. Chàm đậm của header/footer là màu khung |
  | Cyan (`#0E7490`) | `--fg-accent`, `--bg-accent-tint` | Điểm nhấn nhỏ (cuối gradient hero, trạng thái "Đang giao") |
  | Vàng | `--bg-deal`, `--fg-deal` | **Chưa dùng trong MVP** (không có giảm giá, catalog BR-05) |
  | Xanh lá / đỏ / cam | `--fg-success`, `--fg-danger`, `--fg-warning` + nền `*-tint` | Trạng thái: còn hàng, lỗi, sắp hết, giá đã đổi |

  Mỗi màn hình chỉ có **một** nút chàm chính.
- **Giá màu đen** `--fg-price` (`#1A1A1A`), đậm 700, luôn qua component `Price`. Không tô giá bằng màu thương hiệu.
- **Ảnh sản phẩm nằm trên ô nền xám nhạt** `--bg-subtle` (`#F5F5F5`) với `mix-blend-mode: multiply`.
- **Khối sản phẩm không có khung** (chốt 11/10/2026, bản mẫu 9, theo ảnh tham khảo của Hoàng): tiêu đề và hàng thẻ nằm thẳng trên nền trang xám; mỗi **thẻ** là một ô trắng bo 12px có viền mảnh. Bóng chỉ dùng cho thứ nổi lên (thẻ khi rê chuột, nút tròn, menu, hộp thoại) và hàng 2 của header.

## 2. Màu (token)

Bảng màu chàm (chốt 11/10/2026). Cột "Tương phản" là tỉ lệ WCAG đã đo; chữ thường cần ≥ 4,5, viền ô nhập và focus ≥ 3.

### 2.1 Nền

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg-canvas` | `#F5F5F5` | Nền trang |
| `--bg-surface` | `#FFFFFF` | Khối, thẻ, menu |
| `--bg-subtle` | `#F5F5F5` | Ô ảnh sản phẩm |
| `--bg-surface-raised` | `#FAFAFA` | Ô tìm kiếm trên header, ô nhập, nút phụ, hàng lẻ của bảng thông số |
| `--bg-surface-pressed` | `#EEEEEE` | Nhấn, hover của nút phụ |
| `--bg-chrome` | `#4338CA` | **Header hàng 1 và footer** (chữ trắng 7,90) |
| `--bg-chrome-strong` | `#3730A3` | Nút "Danh mục" trên header, nút menu trên điện thoại (chữ trắng 9,93) |
| `--bg-chrome-hover` | `rgba(255,255,255,.12)` | Hover của nút trên header |
| `--bg-primary` / `-hover` / `-pressed` | `#4F46E5` / `#4338CA` / `#3730A3` | Nút chính; hover và nhấn **tối đi** (chữ trắng 6,29 / 7,90 / 9,93) |
| `--bg-primary-tint` / `-tint-2` | `#EEF2FF` / `#E0E7FF` | Hover của mục menu và link nav; ô icon (`-tint-2`), mục đang chọn |
| `--bg-accent-tint` | `#CFFAFE` | Nhãn cyan |
| `--bg-success-tint` / `--bg-warning-tint` / `--bg-danger-tint` | `#DCFCE7` / `#FEF3C7` / `#FFE4E6` | Nền nhãn trạng thái |
| `--bg-transparent-hover` / `-pressed` | `rgba(0,0,0,.04)` / `.08` | Hover và nhấn của nút trong suốt |
| `--scrim` | `rgba(0,0,0,.5)` | Nền tối sau hộp thoại, menu tài khoản |
| `--bg-deal` | `#F5B83D` | Để dành (sau MVP) |

### 2.2 Chữ và icon

| Token | Giá trị | Tương phản |
|---|---|---|
| `--fg-default` | `#1A1A1A` | 17,40 trên trắng |
| `--fg-heading` | `#262626` | 15,13 (tiêu đề khối, tên sản phẩm, link nav) |
| `--fg-muted` | `#525252` | 7,81 (7,17 trên `#F5F5F5`) |
| `--fg-subdued` | `#737373` | 4,74 **chỉ trên nền trắng** (trên `#F5F5F5` chỉ 4,35, không dùng cho chữ) |
| `--fg-icon-soft` | `#A3A3A3` | icon trang trí, ảnh thay thế (không dùng cho chữ) |
| `--fg-placeholder` | `#737373` | 4,74 trên ô nhập trắng |
| `--fg-disabled` | `#A3A3A3` | (được miễn) |
| `--fg-price` | `#1A1A1A` | 17,40 |
| `--fg-on-primary` | `#FFFFFF` | trên nút chàm |
| `--fg-on-chrome` / `--fg-on-chrome-muted` | `#FFFFFF` / `#C7D2FE` | 7,90 / 5,30 trên header, footer |
| `--fg-primary` / `-hover` | `#4338CA` / `#3730A3` | 7,90 / 9,93 |
| `--fg-accent` | `#0E7490` | 5,36 |
| `--fg-success` | `#15803D` | 5,02 (4,57 trên `#DCFCE7`) |
| `--fg-warning` | `#B45309` | 5,02 (4,51 trên `#FEF3C7`) |
| `--fg-danger` | `#BE123C` | 6,29 (5,24 trên `#FFE4E6`) |

### 2.3 Viền và focus

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--border-divider` | `#E5E5E5` | Viền menu, ô thông tin, ô tìm, thẻ khi rê chuột, đường kẻ |
| `--border-default` | `#D4D4D4` | Viền nút phụ, chip, vạch ngăn trong hàng tiêu đề khối |
| `--border-input` | `#8C8C8C` | Ô nhập, checkbox (3,36 trên trắng ✓; không dùng `#9E9E9E` vì chỉ 2,68) |
| `--border-primary` | `#4F46E5` | Mục đang chọn, ô nhập đang focus |
| `--border-on-chrome` / `-subtle` | `rgba(255,255,255,.38)` / `.22` | Vạch ngăn trên header / đường kẻ trong footer |
| `--focus-ring` / `--focus-ring-on-chrome` | `#4F46E5` / `#FFFFFF` | Viền focus 2px. Trên header, footer và hero dùng màu trắng |

### 2.4 Hiệu ứng thương hiệu

| Token | Giá trị | Dùng ở đâu |
|---|---|---|
| `--gradient-brand` | `linear-gradient(135deg, #1E1B4B 0%, #3730A3 35%, #4F46E5 70%, #22D3EE 100%)` | **Chỉ** hero trang chủ. Chữ trắng chỉ đặt trên khoảng 60% phía tối (trái, trên) |
| `--gradient-logo` | `linear-gradient(135deg, #C7D2FE, #FFFFFF)` | Ô logo trên header và footer |
| `--hero-ink` | `#1E1B4B` | Chữ của nút trắng trên hero, icon trong ô logo |

## 3. Chữ

Font **Inter** (`--font-sans`, dự phòng system-ui, -apple-system, Segoe UI, Roboto), tải kèm subset `vietnamese`, các độ đậm 400 / 500 / 600 / 700. Số liệu kỹ thuật có thể dùng `--font-mono`. `<html lang="vi">`. Cỡ chữ lấy theo trang tham khảo chính.

| Vai trò | Cỡ / line-height / đậm | Dùng ở |
|---|---|---|
| Tiêu đề hero | 28 / 36 / 700 (<1280: 24 / 32) | Hero trang chủ |
| Giá lớn | 32 / 44 / 700 | `Price lg` (trang chi tiết) |
| Tiêu đề khối sản phẩm | **24 / 32 / 700** `--fg-default` (<1280: 20 / 28) | Tiêu đề hàng sản phẩm ở trang chủ |
| H1 trang | 24 / 32 / 600 (<640: 20 / 28) | H1 trang danh sách, giỏ, đặt hàng |
| Tiêu đề hộp | 20 / 28 / 600 | `OrderSummary`, hộp thoại |
| Giá thẻ | **17 / 24 / 700** (<1280: 15 / 22) | `Price md` |
| **Nội dung mặc định** | **16 / 24 / 400** | `body`, nút trên header |
| Link nav, link "Xem tất cả" | 16 / 22 / 600 | Header hàng 2, đầu khối |
| Nội dung phụ | 14 / 20 / 400–500 | Mô tả ô, nút, form |
| Mục menu danh mục | 14 / 18 / 500 | `CategoryMenu` |
| Tên sản phẩm trong thẻ | **13 / 20 / 600**, **một dòng**, cắt `…` (<1280: 12 / 18) | `ProductCard` |
| Chú thích, nhãn | 12 / 16–18 / 500–600 | `Badge`, chú thích ô nhập |

Quy tắc:
- Độ đậm: **400** nội dung, **500** nhấn nhẹ, **600** tiêu đề, link nav và nút, **700** giá, logo, tiêu đề hero.
- `h1`, `h2`, `h3` mặc định 600, margin 0 (`base.css`).
- **Không viết hoa toàn bộ** tiêu đề tiếng Việt.
- Giá, số lượng, tổng tiền: `font-variant-numeric: tabular-nums`.
- Cắt chữ nhiều dòng bằng `-webkit-line-clamp` và luôn kèm `min-height` giữ chỗ. Tên trong thẻ sản phẩm chỉ một dòng (`white-space:nowrap; text-overflow:ellipsis`), tên đầy đủ đọc được qua link và trang chi tiết.
- Ô nhập trên điện thoại dùng cỡ chữ **≥ 16px**.

## 4. Khoảng cách, bo góc, bóng, chuyển động

**Khoảng cách** (bậc 4px): `--space-50` 4 · `--space-100` 8 · `--space-150` 12 · `--space-200` 16 · `--space-300` 24 · `--space-400` 32 · `--space-500` 40 · `--space-600` 48 · `--space-800` 64. Giá trị lẻ (10px trong ô tìm và nút header) chỉ dùng đúng chỗ ghi trong §9.1.

Hay dùng nhất: **8** (giữa các ô ở hàng đầu trang chủ, gap trong thẻ), **12** (gap trong header, lưới thẻ trên điện thoại), **16** (giữa tiêu đề khối và hàng thẻ, giữa thẻ trên máy tính), **24** (giữa các khối sản phẩm, giữa link hàng 2 header), **32** (padding trên hàng đầu trang chủ).

**Bo góc:**
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--radius-md` | 4px | Nhãn, badge, ô icon trong menu danh mục |
| `--radius-lg` | 8px | **Nút, ô nhập, mục menu, ô icon** |
| `--radius-btn` | 10px | Nút trên header (Danh mục, Đơn hàng, Đăng nhập, Giỏ hàng) |
| `--radius-xl` | 12px | **Thẻ sản phẩm**, menu danh mục, hero, ô thông tin, ô "Thường mua kèm" |
| `--radius-2xl` | 16px | Hộp thoại, menu tài khoản, ô trạng thái rỗng |
| `--radius-full` | 9999px | **Ô tìm kiếm** (viên thuốc), nút tìm tròn, chip, nút tròn, nhãn tròn |

Quy tắc lồng: thẻ 12px chứa ô ảnh chạm mép (bo theo thẻ) và nhãn 4px; ô 12px chứa ô icon 8px.

**Bóng** (màu đen trong suốt):
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.08)` | Hàng 2 của header |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.12)` | Nút tròn ‹ › ngoài dải sản phẩm |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,.16)` | Menu, hộp thoại |
| `--shadow-card-hover` | `0 8px 24px rgba(0,0,0,.10)` | Thẻ sản phẩm, ô "Thường mua kèm" khi rê chuột |
| `--shadow-glass` | `0 4px 16px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.6)` | Nút mũi tên 42px của dải sản phẩm |
| `--shadow-up` | `0 -2px 8px rgba(0,0,0,.12)` | Thanh tổng tiền dính đáy (giỏ hàng trên điện thoại) |

**Chuyển động:** `--dur-fast` 150ms (màu nền, viền), `--dur-base` 200ms (bóng thẻ, xoay icon), `--dur-medium` 300ms (phóng icon/ảnh trong thẻ 105% khi rê chuột, hiện nút carousel); easing `--ease-standard`. `base.css` tắt toàn bộ animation khi `prefers-reduced-motion: reduce`.

## 5. Bố cục và responsive

| Thứ | Giá trị |
|---|---|
| Bề rộng nội dung tối đa | `--content-max` **1920px**, căn giữa (Hoàng chốt 11/10/2026: giữ gần hết màn 1920, không bó vào 1200px) |
| Lề hai bên `--gutter` | 16px (<640) → 24px (≥640) → 40px (≥960) → 64px (≥1280) |
| Breakpoint | **640**, **768** (lưới thẻ 2 cột → dải cuộn), **960** (bố cục hai cột của trang con), **1280** (header đầy đủ 2 hàng, menu danh mục trái ở trang chủ), **1600** (7 thẻ mỗi hàng) |
| Màn kiểm thử | 1920px, 1366px, 390px |
| Khung hẹp | Giỏ hàng, đặt hàng: rộng tối đa **1280px**, căn giữa |
| Bố cục hai cột (≥960) | Trang chi tiết, giỏ hàng, đặt hàng: `grid-template-columns: minmax(0,1fr) 360px; gap:24px; align-items:start` |
| Khoảng cách giữa các khối sản phẩm | mỗi khối có padding trên 24px (điện thoại 20px), dưới 4px; tiêu đề cách hàng thẻ 16px |

Quy tắc:
- Thiết kế từ điện thoại lên (`min-width`).
- Mọi phần tử con của flex/grid chứa carousel hoặc chữ bị cắt phải có `min-width: 0`.
- Màn cảm ứng (`@media (hover: none)`): ẩn nút ‹ ›, người dùng vuốt.

## 6. Trạng thái tương tác

| Thành phần | Hover | Focus bàn phím | Nhấn | Vô hiệu | Đang chọn |
|---|---|---|---|---|---|
| Nút chính | `--bg-primary-hover` (tối hơn) | viền focus | `--bg-primary-pressed` | opacity .4, `not-allowed` | — |
| Nút phụ (mặc định) | `--bg-surface-pressed` | viền focus | `--bg-surface-pressed` | chữ `--fg-disabled`, `not-allowed` | — |
| Nút trong suốt / link-nút | `--bg-transparent-hover` | viền focus | `--bg-transparent-pressed` | chữ `--fg-disabled` | — |
| Link | `--fg-primary-hover` + gạch chân | viền focus | — | — | `aria-current` → `--fg-primary` |
| Chip, link nav | nền `--bg-primary-tint` | viền focus | — | — | nền `--bg-primary-tint-2`, chữ `--fg-primary`; chip có thêm viền **2px** `--border-primary` (bớt 1px padding để không nhảy) |
| Mục menu danh mục | nền `--bg-primary-tint` | viền focus | — | — | nền `--bg-primary-tint-2`, chữ `--fg-primary` 600 |
| Thẻ sản phẩm | viền `--border-default` + `--shadow-card-hover`, icon/ảnh phóng 105% | viền focus quanh **cả thẻ** (`:focus-within`) | — | ô ảnh opacity .6 (hết hàng/ngừng bán) | — |
| Ô nhập, select | — | viền `--border-primary` + viền focus | — | chữ `--fg-disabled` | — |
| Nút mũi tên dải sản phẩm | nền trắng 100% | viền focus | — | ẩn | — |

**Viền focus** (`base.css`, áp cho mọi phần tử): `outline: 2px solid var(--focus-ring); outline-offset: 2px`. Không bao giờ xoá outline mà không thay bằng viền khác. Trên header, footer và hero (nền chàm), viền focus màu trắng.

## 7. Trợ năng

- Link "Bỏ qua tới nội dung chính" (`.skip-link`) ở đầu trang, trỏ tới `<main id="main">`.
- Mỗi trang có đúng một `<h1>` (có thể `sr-only` như trang chủ); khối nội dung là `<section aria-labelledby>` trỏ tới tiêu đề hiển thị.
- Icon trang trí `aria-hidden="true"`; nút chỉ có icon phải có `aria-label` tiếng Việt ("Tìm", "Giảm số lượng …").
- Giá có bản đọc cho trình đọc màn hình ("24.990.000 đồng"), do `Price` lo.
- Thông báo lỗi dùng `role="alert"`; thông báo thành công dùng `role="status"`. Danh sách đang tải lại dùng `aria-busy="true"`.
- Carousel: `role="group"` + `aria-roledescription="carousel"` + `aria-label`; nút ‹ › có nhãn "{tên}: xem trước / xem tiếp".
- Tương phản đạt WCAG AA (chữ ≥ 4,5:1, viền ô nhập và focus ≥ 3:1). Các cặp trong `tokens.css` đã kiểm.
- In trang: `base.css` bỏ nền và bóng, chữ đen.

## 8. Icon và ảnh

- Icon: **`lucide-react`**, nét `strokeWidth={1.75}`, màu theo `currentColor`. Cỡ: 16 (trong chữ), 20 (trong chip), 24 (mặc định, nút tròn), 28 (header máy tính), 32 (ô danh mục), 48–56 (minh hoạ, ảnh thay thế).
- Mỗi loại hàng có một icon cố định trong `CategoryIcon` (laptop → `Laptop`, gpu → `Gpu`, psu → `PlugZap`…). Dùng icon này ở mọi chỗ hiện loại hàng.
- Ảnh sản phẩm: ô vuông (`aspect-ratio: 1`), `object-fit: contain`, `mix-blend-mode: multiply` trên `--bg-subtle`, `loading="lazy" decoding="async"` và có `width`/`height`. Ô ảnh trong thẻ vuông, chạm sát mép thẻ (§9.9). Không có ảnh → icon loại hàng 48–56px màu `--fg-icon-soft` giữa ô.
- `alt=""` khi tên sản phẩm đã có ngay cạnh ảnh (tránh đọc lặp).

## 9. Component dùng chung

Cột "Trạng thái": ✅ đã có trong code, 📝 chưa làm thành component riêng (đang viết trực tiếp trong trang, nên tách ra theo spec này khi sửa trang đó).

| Component | Vị trí | Trạng thái |
|---|---|---|
| Header, Footer, RootLayout, `Logo`, `CategoryMenuButton` | `app/` | ✅ |
| `CategoryMenu` | `features/catalog/components/CategoryMenu.tsx` | ✅ |
| `Price` | `shared/components/Price.tsx` | ✅ |
| `StoryBlock` | `shared/components/StoryBlock.tsx` | ✅ |
| `Carousel`, `CarouselItem` | `shared/components/Carousel.tsx` | ✅ |
| `ProductCard` | `features/catalog/components/ProductCard.tsx` | ✅ |
| `StockBadge` | `features/catalog/components/StockBadge.tsx` | ✅ |
| `CategoryIcon` | `features/catalog/components/CategoryIcon.tsx` | ✅ |
| `Button` (biến thể, cỡ, đang tải) | nên đặt `shared/components/Button.tsx` | 📝 |
| `Field` (nhãn + ô nhập + lỗi/gợi ý) | `shared/components/Field.tsx` | ✅ (ô nhập; select chưa có) |
| `Checkbox` | `shared/components/Checkbox.tsx` | ✅ |
| `QuantityStepper` | `shared/components/QuantityStepper.tsx` | ✅ (giỏ hàng; trang chi tiết chưa dùng) |
| `Badge` (tổng quát, gồm trạng thái đơn) | `shared/components/Badge.tsx` | 📝 |
| `Alert` (lỗi, cảnh báo, thành công) | `shared/components/Alert.tsx` | ✅ |
| `EmptyState` | `shared/components/EmptyState.tsx` | 📝 (đang viết trong trang danh sách) |
| `ConfirmDialog` | `shared/components/ConfirmDialog.tsx` | 📝 |
| `OrderSummary` (khối tóm tắt tiền) | `shared/components/OrderSummary.tsx` | ✅ (giỏ hàng, đặt hàng) |
| `FocusLayout` + `MiniHeader` | `app/FocusLayout.tsx` | 📝 (đặt hàng, đăng nhập, tạo tài khoản) |
| `AccountMenu` (nút tài khoản + bảng thả xuống) | `app/AccountMenu.tsx` | ✅ (header đầy đủ; thay link "Tài khoản") |
| `CategoryMenu` (13 loại hàng: cột trái trang chủ, bảng thả xuống, ngăn kéo) | nên đặt `app/CategoryMenu.tsx` | 📝 |

### 9.1 Header (`app/Header`)
Hai hàng, dính đầu trang (`position: sticky; top: 0; z-index: 210`). Hàng 1 nền `--bg-chrome` (chàm), hàng 2 nền trắng. Bên phải giữ 3 nút như bản trước: Đơn hàng, Đăng nhập (§9.17), Giỏ hàng. Từ 1280px dùng bản máy tính; dưới 1280px dùng bản điện thoại.

**Máy tính (≥1280):**

| Phần | Giá trị |
|---|---|
| Hàng 1 | cao **76px**, padding 16px dọc, lề `--gutter` trong khung `--content-max`; phần tử cao **44px**, cách nhau 12px |
| Logo | ô 36px nền `--gradient-logo` bo 8px, icon `--hero-ink` + chữ "Black Magic" 22/28/700 trắng; cả cụm là link về `/` |
| Cụm giữa | nút "Danh mục" + ô tìm kiếm thành **một cụm** `flex`, gap 12px, `flex: 0 1 872px`, `margin-inline: auto`: cụm **căn giữa khoảng trống** giữa logo và nhóm nút bên phải (màn 1920: nút Danh mục bắt đầu khoảng 440px). Màn hẹp thì ô tìm co lại |
| Nút "Danh mục" | `<button>` nền `--bg-chrome-strong`, chữ trắng 16/24/500, padding `10px 16px`, bo `--radius-btn` (10px), icon `Menu` 24 + chữ, gap 8px. Mở `CategoryMenu` (§9.18) dạng bảng thả xuống. Có ở mọi trang có header đầy đủ, kể cả trang chủ |
| Ô tìm kiếm | Theo ảnh tham khảo của Hoàng (11/10/2026), dạng **viên thuốc**: `role="search"`, co giãn, **rộng tối đa 720px**; cao **48px**, nền `--bg-surface-raised` (`#FAFAFA`), **không viền**, bo `--radius-full`, padding `0 6px 0 22px`; chữ 16px `--fg-default`, placeholder "Tìm laptop, card đồ hoạ, RAM…" `--fg-placeholder` (4,54), `maxLength=30`. Nút tìm **tròn 36px nền `#1A1A1A`** (`--fg-default`), icon `Search` 18 trắng, sát phải trong ô, `aria-label="Tìm"`; hover nền `--bg-chrome-strong`. Focus: viền trắng 2px quanh cả ô (`:focus-within`) |
| Đơn hàng | đầu nhóm nút bên phải; `NavLink` cao 44px, padding `0 10px`, bo 10px, icon `Package` 28 + nhãn 16/24/500, gap 8px; hover nền `--bg-chrome-hover`; trang hiện tại gạch chân 2px trắng dưới nhãn |
| Đăng nhập | nút mở menu tài khoản, cùng kích thước với Đơn hàng: icon `User` 28 + nhãn + `ChevronDown` 16 (§9.17) |
| Vạch ngăn | 1px × 28px `--border-on-chrome`, cách hai bên 6px |
| Giỏ hàng | chỉ icon `ShoppingCart` 30 trong ô 48×44, bo 10px, `aria-label="Giỏ hàng"`; hover nền `--bg-chrome-hover`; trang hiện tại có vạch trắng 2px dưới icon |
| Hàng 2 | cao **56px**, nền `--bg-surface`, `--shadow-sm`; `<nav aria-label="Mua theo nhu cầu">` gồm **6 link xếp thành một cụm căn giữa**, cách nhau **24px** (`justify-content: center; gap: 24px`). Mỗi link cao 42px, padding `10px 12px`, bo 8px, icon 20 `--fg-primary` + chữ 16/22/600 `--fg-heading`, gap 8px; hover nền `--bg-primary-tint`; link của trang đang xem: nền `--bg-primary-tint-2`, chữ `--fg-primary` |

Sáu link hàng 2 (nhóm khách theo project-plan, đường dẫn là bộ lọc đã có):

| Link | Icon | Tới |
|---|---|---|
| Hàng mới về | `Sparkles` | `/products` (mới nhất) |
| Chơi game | `Gamepad2` | `/products?category=gpu` |
| Làm văn phòng | `Briefcase` | `/products?category=laptop` |
| Học lập trình | `CodeXml` | `/products?category=ram` |
| Thiết kế, dựng phim | `Clapperboard` | `/products?category=monitor` |
| Tất cả sản phẩm | `LayoutGrid` | `/products` |

**Điện thoại và máy tính bảng (<1280):**

| Phần | Giá trị |
|---|---|
| Hàng 1 | cao **56px**, padding `8px` dọc, lề `--gutter`; phần tử 40×40 |
| Trái | nút menu: ô 40px nền `--bg-chrome-strong`, bo 10px, icon `Menu` 24, `aria-label="Danh mục"`; mở `CategoryMenu` dạng ngăn kéo (§9.18) |
| Giữa | logo (ô 30px + chữ 18/24/700), căn giữa |
| Phải | nút Đăng nhập (chỉ icon `User` 28, mở §9.17) + Giỏ hàng (icon 30). Nút Đơn hàng không ở hàng này (xem ghi chú dưới) |
| Hàng tìm | ô tìm viên thuốc rộng hết, cao **44px**, padding `0 4px 0 18px`, nút tìm tròn 36px; nằm trong nền chàm, padding `0 var(--gutter) 12px` |
| Hàng 2 (6 link) | **không hiện** |

Ghi chú điện thoại: trang tham khảo chỉ có nút menu, logo, giỏ. Black Magic cần thêm đường tới **Đơn hàng** trên điện thoại: đặt link "Đơn hàng" (icon `Package`) ở đầu `CategoryMenu` dạng ngăn kéo, trên 13 loại hàng (§9.18). Không thêm nút thứ tư vào hàng 1 để logo còn chỗ.

Gõ từ khoá rồi Enter → `/products?q=…` (bỏ khoảng trắng hai đầu, rỗng thì về `/products`). Ô tìm kiếm hiện lại từ khoá đang có trên URL.

Hàng chip 13 loại hàng trên nền chàm của bản trước **bỏ**: 13 loại hàng nằm trong `CategoryMenu`. Loại hàng đang xem được đánh dấu trong `CategoryMenu` và trong tiêu đề trang danh sách.

### 9.2 Footer (`app/Footer`)
**Cùng màu với header**: nền `--bg-chrome` (chàm), cách nội dung 32px; khung `--content-max` với lề `--gutter`, padding `64px` trên, `32px` dưới (<1280: `40px` / `24px`).
- Lưới 4 cột `1.4fr 1fr 1fr 1.2fr`, gap `32px 40px` (<1280: 2 cột, cột đầu chiếm cả hàng; gap `24px 16px`).
- Cột 1: logo (như header, chữ 20px) + đoạn giới thiệu 14/20 `--fg-on-chrome-muted`, rộng tối đa 34 ký tự: "Laptop và linh kiện PC, có gợi ý món thường mua kèm. Dự án thực tập FCAJ 2026, dữ liệu sản phẩm là giả lập."
- Cột 2–4: tiêu đề 16/20/600 trắng, cách danh sách 12px; mục 14/18/500 trắng, cách nhau 8px. "Mua sắm": Tất cả sản phẩm, Hàng mới về, Card đồ hoạ, Laptop. "Tài khoản": Đăng nhập, Tạo tài khoản, Đơn hàng. "Giao hàng và thanh toán": icon `Truck` 18 + "Giao hàng miễn phí mọi đơn"; icon `Banknote` 18 + "Thanh toán khi nhận hàng (COD)" (icon màu `--fg-on-chrome-muted`).
- Dòng cuối: viền trên 1px `--border-on-chrome-subtle`, padding trên 20px, chữ 12/16/500 `--fg-on-chrome-muted`: "© 2026 Black Magic · Sản phẩm, giá và tồn kho chỉ dùng để demo."
- Link gạch chân khi hover; viền focus trắng. Không có mạng xã hội, tổng đài, showroom, chứng nhận (không có trong phạm vi).

### 9.3 Nút (`Button`, 📝)
Hình dạng chung: `display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid; border-radius:8px`, chữ 14/20 **600** một dòng (nút `lg`: 16/24/600). Nút trên header có kiểu riêng (§9.1, bo 10px). (`base.css` hiện cho mọi `<button>` kiểu nút phụ, chữ 400; khi tách component `Button` thì dùng 600.)

| Cỡ | Chiều cao tối thiểu | Padding | Dùng cho |
|---|---|---|---|
| `sm` | 32px | `4px 12px` | Nút phụ trong dòng (Xoá trong giỏ, nút ± của bộ chọn số lượng dùng ô vuông 40px) |
| `md` | 40px | `8px 16px` | Mặc định: "Xem thêm sản phẩm", "Quay lại", nút trong form |
| `lg` | 48px | `8px 24px` | Hành động chính của trang: "Thêm vào giỏ", "Đặt hàng", "Xác nhận đặt hàng", nút hero |

| Biến thể | Nền | Viền | Chữ | Hover / nhấn |
|---|---|---|---|---|
| `primary` | `--bg-primary` | `--bg-primary` | `--fg-on-primary` | `-hover` / `-pressed` |
| `secondary` (mặc định) | `--bg-surface-raised` | `--border-default` | `--fg-default` | `--bg-surface-pressed` |
| `ghost` | trong suốt | trong suốt | `--fg-primary` | `--bg-transparent-hover` / `-pressed` |
| `danger` (Huỷ đơn, Xoá) | `--bg-surface-raised` | `--border-default` | `--fg-danger` | nền `--bg-danger-tint` |
| `on-gradient` (chỉ hero) | `#FFFFFF` | không | `--hero-ink` | nền `--bg-primary-tint` |
| `on-gradient-outline` (chỉ hero) | trong suốt | `rgba(255,255,255,.45)` | `#FFFFFF` | nền `rgba(255,255,255,.12)` |

- `width: 100%` khi cần nút tràn ngang (thanh tổng tiền trên điện thoại).
- **Đang xử lý** (`aria-busy="true"`): giữ nguyên bề rộng, đổi chữ thành "Đang …" (ví dụ "Đang huỷ…", "Đang tải…"), chặn bấm lại.
- Mỗi màn hình chỉ một nút `primary`.

### 9.4 Ô nhập và select (`Field`, ✅)
| Thuộc tính | Giá trị |
|---|---|
| Chiều cao | 40px (mặc định), 48px (form đặt hàng) |
| Padding | `0 12px` |
| Nền / viền | `--bg-surface-raised` / 1px `--border-input`, bo 8px (`base.css`) |
| Chữ | 14/20 (≥640), **16px trên điện thoại**; placeholder `--fg-placeholder` |
| Focus | viền `--border-primary` + viền focus 2px |
| Nhãn | phía trên, cách 4px. Bộ lọc: 12/18 `--fg-subdued`. Form: 14/20/500 `--fg-default`, trường bắt buộc có dấu `*` màu `--fg-danger` |
| Lỗi | viền `--fg-danger`; dòng lỗi 12/18 `--fg-danger` bên dưới, nối bằng `aria-describedby`, `aria-invalid="true"` |
| Gợi ý | 12/18 `--fg-subdued` bên dưới |
| Select | cùng hình dạng; mũi tên mặc định của trình duyệt (`color-scheme: light`) |

- **Cỡ 48px** dùng cho form đặt hàng, đăng nhập, tạo tài khoản; 40px cho bộ lọc và chỗ khác.
- Dòng lỗi có icon `CircleAlert` 16px cùng màu đứng trước chữ, gap 4px.
- Luôn đặt `autocomplete` đúng nghĩa (`name`, `tel`, `email`, `username`, `current-password`, `new-password`, `one-time-code`…).
- **Ô mật khẩu (`PasswordField`)**: như ô nhập, `padding-right: 48px`; trong ô, sát phải cách 4px, nút `ghost` vuông 40×40 icon `Eye` / `EyeOff` 20px màu `--fg-subdued`, `aria-label` "Hiện mật khẩu" / "Ẩn mật khẩu", `aria-pressed`. Bấm chỉ đổi `type` giữa `password` và `text`, focus vẫn ở ô.

Form cụ thể ở [pages/dat-hang.md](pages/dat-hang.md) và [pages/dang-nhap.md](pages/dang-nhap.md).

### 9.5 Checkbox (`Checkbox`, ✅; dùng ở giỏ hàng để tick món)
20×20px, bo 4px, nền `--bg-surface-raised`, viền 1px `--border-input`. Được chọn: nền và viền `--bg-primary`, dấu tick trắng (lucide `Check` 14px). Hover: viền `--border-primary`. Focus: viền focus. Không chọn được (món hết hàng, ngừng bán, vượt tồn kho): opacity .4, `not-allowed`, kèm lý do bằng `StockBadge` cạnh tên món. Nhãn cách 8px; vùng bấm tối thiểu 40×40. Chọn một phần (`indeterminate`, ô "Chọn tất cả" ở giỏ): nền và viền `--bg-primary`, gạch ngang trắng (lucide `Minus` 14px).

### 9.6 Bộ chọn số lượng (`QuantityStepper`, ✅; trang chi tiết và giỏ hàng)
`[−] [số] [+]` liền nhau, cao 40px: hai nút vuông 40×40 kiểu nút phụ (bo `8px 0 0 8px` và `0 8px 8px 0`), ô giữa rộng 48px, chữ 14/20/600 `tabular-nums`, căn giữa, viền trên và dưới `--border-default`. Giới hạn **1 … min(99, tồn kho)** (cart BR-03): tới biên thì nút tương ứng vô hiệu. Nhãn nút: "Giảm số lượng {tên}", "Tăng số lượng {tên}". Server trả `QUANTITY_LIMIT` → dòng `Alert` cảnh báo "Chỉ thêm được tối đa {maxAddable} sản phẩm nữa".

### 9.7 Nhãn (`Badge` 📝 / `StockBadge` ✅)
Hình dạng chung (giống `StockBadge`): `display:inline-block; padding:2px 8px; border-radius:4px`, chữ 12/18/500, không xuống dòng.

| Biến thể | Nền | Chữ |
|---|---|---|
| `success` | `--bg-success-tint` | `--fg-success` |
| `warning` | `--bg-warning-tint` | `--fg-warning` |
| `danger` | `--bg-danger-tint` | `--fg-danger` |
| `primary` | `--bg-primary-tint` | `--fg-primary` |
| `accent` | `--bg-accent-tint` | `--fg-accent` |
| `neutral` | `--bg-surface-raised` | `--fg-subdued` |

Nhãn có trong nghiệp vụ:
| Nhãn | Khi nào | Biến thể |
|---|---|---|
| Còn hàng | `stock > 5` | success |
| Chỉ còn N | `0 < stock ≤ 5` (`LOW_STOCK = 5`) | warning |
| Hết hàng | `stock ≤ 0` | danger |
| Ngừng bán | `status = INACTIVE` (chỉ thấy trong giỏ) | danger |
| Chỉ còn X sản phẩm (giỏ) | `0 < stock < quantity` | warning |
| Giá đã thay đổi (giỏ, đặt hàng) | giá hiện tại ≠ giá lúc thêm (cart BR-06, ordering BR-07) | warning |
| Chờ xác nhận | đơn `PENDING` | neutral |
| Đã xác nhận | `CONFIRMED` | primary |
| Đang giao | `SHIPPED` | accent |
| Đã giao | `DELIVERED` | success |
| Đã huỷ | `CANCELLED` | danger |

(Chữ trạng thái đơn lấy từ `STATUS_LABEL` trong `features/orders/types.ts`.)

### 9.8 Giá (`Price` ✅)
`24.990.000đ` qua `formatVnd`; đậm 700, `tabular-nums`, không xuống dòng, màu `--fg-price` (**đen**, không tô màu). Trình đọc màn hình nghe "24.990.000 đồng".

| Cỡ | Số | Dùng ở |
|---|---|---|
| `md` (mặc định) | 17/24 (<1280: 15/22) | Thẻ sản phẩm, dòng giỏ hàng, tóm tắt đơn |
| `lg` | 32/44 | Trang chi tiết, tổng tiền đặt hàng |

Ký hiệu tiền: trang tham khảo viết `đ` liền sau số, chữ thường cùng cỡ; code hiện viết `₫` nhỏ hơn. Giữ cách của code (`₫`) cho tới khi Hoàng đổi.

Không có giá cũ, phần trăm giảm hay "tiết kiệm" (catalog BR-05). Phí vận chuyển hiển thị chữ "Miễn phí" (ordering BR-06), không phải "0₫".

### 9.9 Thẻ sản phẩm (`ProductCard` ✅)
Chốt 11/10/2026 theo **ảnh tham khảo của Hoàng** (bản mẫu 9), thay cho thẻ kiểu cũ. Dùng ở mọi lưới và dải sản phẩm. Một kiểu duy nhất.

| Phần | Giá trị |
|---|---|
| Thẻ | `--bg-surface`, viền 1px `--border-divider`, bo **12px**, `overflow:hidden`, `display:flex; flex-direction:column; height:100%`; không có bóng lúc bình thường |
| Hover | viền `--border-default` + `--shadow-card-hover` (200ms); icon/ảnh trong ô phóng 105% (300ms) |
| Bấm | cả thẻ bấm được nhờ `::after` của link tiêu đề phủ kín thẻ; chỉ tiêu đề là link thật |
| Focus | viền focus quanh cả thẻ (`:focus-within`) |
| Ô ảnh | **vuông, chạm sát mép thẻ** (không padding), nền `--bg-subtle`; ảnh `contain` + `multiply`, lazy. Không có ảnh → icon loại hàng 56px `--fg-icon-soft` giữa ô |
| Phần chữ | viền trên 1px `--border-divider`, padding `12px 14px 14px` (<1280: `10px 10px 12px`), xếp dọc gap 8px |
| Tên | `<h3>` **13/20/600** `--fg-default`, **một dòng**, dài thì cắt `…` (<1280: 12/18) |
| Dòng cuối | `Price md` bên trái, `StockBadge` cỡ nhỏ bên phải (11/16/600, padding `1px 6px`, bo 4px), `justify-content: space-between`. Dưới 1280px xếp dọc: giá rồi nhãn |
| Hết hàng / ngừng bán | ô ảnh opacity .6, vẫn bấm vào xem được |

So với ảnh tham khảo: **tim và số lượt thích** thay bằng nhãn tồn kho (không có yêu thích, đánh giá); **nút "…"** cạnh tên bỏ (không có thao tác); không có ô thông số (thông số xem ở trang chi tiết).

Thẻ **không có** nút "Thêm vào giỏ", giá gốc, nhãn "-%", ô "Mua kèm giá ưu đãi", ô quà tặng, nút lưu, so sánh, sao đánh giá (ngoai-pham-vi.md).

### 9.10 Khối sản phẩm (`StoryBlock` ✅)
Chốt 11/10/2026 (bản mẫu 9): **không có khung**. `<section aria-labelledby>` nền trong suốt, không viền, không padding ngang; nằm thẳng trên nền trang, padding trên 24px (<1280: 20px), dưới 4px.
- Hàng tiêu đề: `flex`, `align-items:center`, gap 12px.
  - `<h2>` **24/32/700** `--fg-default` (<1280: 20/28).
  - Link "Xem tất cả" tuỳ chọn, đẩy sang phải: 16/22/600 `--fg-primary`, không icon, gạch chân khi rê chuột (<1280: 14/20). Ở mọi cỡ màn hình đều nằm trên hàng tiêu đề.
  - Không có dòng phụ cạnh tiêu đề.
- Hàng thẻ cách hàng tiêu đề **16px**.

### 9.11 Dải sản phẩm (`Carousel` ✅)
- **≥1280:** hàng ngang `display:flex; gap:16px; overflow-x:auto; scroll-snap-type:x mandatory`, ẩn thanh cuộn. Mỗi ô `flex: 0 0 calc((100% - 96px) / 7)` (**7 thẻ**) từ 1600px; `calc((100% - 80px) / 6)` (**6 thẻ**) từ 1280 tới 1599px.
- **768–1279:** cùng hàng ngang, ô rộng 220px, vuốt hoặc kéo.
- **<768:** lưới **2 cột**, gap 12px, không cuộn ngang, hiện **4 thẻ đầu**.
- Nút mũi tên (≥1280, chỉ khi còn thẻ phía sau): tròn **42px**, đè lên mép phải hàng thẻ (lệch ra ngoài 20px), ngang giữa ô ảnh; nền trắng 75% + `backdrop-filter: blur(6px)`, viền 1px trắng 50%, `--shadow-glass`, icon `ChevronRight` / `ChevronLeft` 22 `--fg-heading`. Ẩn trên màn cảm ứng.
- Số thẻ 6/7 tính theo **bề rộng của chính dải** (container query: từ 1100px là 6 thẻ, từ 1400px là 7 thẻ), không theo bề rộng màn hình, để dải đặt trong cột hẹp (giỏ hàng rỗng) vẫn dùng thẻ 220px cuộn ngang thay vì 7 thẻ quá nhỏ. Ở trang chủ hai cách tính cho cùng kết quả.
- Không tự chạy, không có chấm phân trang.
- `role="group"` + `aria-roledescription="carousel"` + `aria-label`; nút có nhãn "{tên khối}: xem tiếp / xem trước".

### 9.12 Trạng thái tải, rỗng, lỗi
| Trạng thái | Cách hiển thị |
|---|---|
| Đang tải lần đầu (dải sản phẩm) | khung chờ đúng kích thước thẻ (cao 360px, bo 8px), gradient `#EEEEEE → #F5F5F5` chạy 1,6s, `aria-hidden` |
| Đang tải (trang) | dòng "Đang tải …" màu `--fg-subdued` |
| Đang tải lại với bộ lọc mới | giữ kết quả cũ, lưới opacity .6, `aria-busy="true"` |
| Rỗng (`EmptyState`) | khung `--bg-surface`, viền `--border-divider`, **bo 16px**, padding `40px 16px`, chữ căn giữa; một câu giải thích + một link/nút đi tiếp |
| Lỗi tải | dòng chữ `--fg-subdued` "Chưa tải được … Tải lại trang để thử lần nữa.", `role="alert"` |
| Lỗi nghiệp vụ (`Alert`) | xem 9.13 |

### 9.13 Thông báo (`Alert`, ✅)
Khung bo 8px, padding `12px 16px`, viền trái 4px theo màu trạng thái, nền `*-tint` tương ứng, chữ 14/20 `--fg-default`, icon lucide 20px màu trạng thái bên trái (`CircleCheck`, `TriangleAlert`, `CircleX`). Lưới 3 cột `20px | chữ | nút`: icon thẳng hàng với dòng chữ đầu. Có nút đi kèm (prop `action`, vd. "Gộp vào giỏ"): máy tính đặt sát mép phải, icon, chữ, nút cùng nằm giữa theo chiều cao; điện thoại (<640) nút xuống dòng dưới chữ, thẳng lề trái với chữ.
| Loại | Ví dụ trong nghiệp vụ | Vai trò ARIA |
|---|---|---|
| success | "Đã thêm vào giỏ", "Đặt hàng thành công! Email xác nhận sẽ được gửi trong ít phút." | `status` |
| warning | `PRICE_CHANGED` ("Giá đã thay đổi. Vui lòng kiểm tra rồi bấm xác nhận lại."), `QUANTITY_LIMIT` | `alert` |
| danger | `OUT_OF_STOCK` (kèm danh sách món và số còn lại), `CART_FULL`, lỗi mạng, `CANNOT_CANCEL` | `alert` |

### 9.14 Hộp thoại xác nhận (`ConfirmDialog`, 📝; ví dụ "Huỷ đơn")
Dùng `<dialog>` gốc của trình duyệt (tự giữ focus, Esc để đóng). Rộng tối đa 480px (điện thoại: `calc(100% - 32px)`), nền `--bg-surface`, viền 1px `--border-divider`, bo 16px, padding 24px, `--shadow-lg`; `::backdrop` là `--scrim`. Tiêu đề 20/28/600, nội dung 14/20 `--fg-muted`, hàng nút căn phải cách 24px: "Giữ đơn" (secondary) + "Huỷ đơn" (danger).

### 9.15 Tóm tắt đơn (`OrderSummary`, ✅; giỏ hàng, đặt hàng)
Khối `<section aria-labelledby>`: `--bg-surface`, viền `--border-divider`, bo 16px, padding 24px (<640: 16px).
- Tiêu đề `<h2>` 20/28/600, cách nội dung 16px. Nội dung riêng của trang (danh sách món ở trang đặt hàng) nằm ngay dưới tiêu đề.
- Các dòng tiền: `<dl>`, mỗi dòng `display:flex; justify-content:space-between; gap:16px`, 14/20, cách nhau 8px; nhãn `--fg-muted`, số `--fg-default` `tabular-nums`. "Phí vận chuyển" luôn là chữ "Miễn phí" màu `--fg-success`.
- Đường kẻ 1px `--border-divider` cách 16px trên dưới, rồi dòng **Tổng cộng**: nhãn 16/24/600, số là `Price md`.
- Dưới tổng, cách 24px: (tuỳ trang) `Alert`, rồi một `Button primary lg` rộng 100%, rồi chú thích 12/18 `--fg-subdued` (gap 8px).
- Không có dòng tạm tính (giỏ rỗng) thì bỏ luôn đường kẻ, dòng Tổng cộng nằm ngay dưới tiêu đề.
- Không có dòng giảm giá, thuế, mã khuyến mãi, điểm thưởng, thanh toán trực tuyến.

### 9.16 Bố cục tập trung (`FocusLayout` + `MiniHeader`, 📝; đặt hàng, đăng nhập, tạo tài khoản)
Thay `RootLayout` ở những trang khách cần tập trung hoàn tất một việc: bỏ ô tìm kiếm, nút Danh mục, hàng 2 và các nút bên phải.
- `MiniHeader`: nền `--bg-chrome`, **không dính**, **không có nút tài khoản** (§9.17), cao 64px (<640: 56px), khung `--content-max` với lề như header; trái là logo (ô 40px + chữ "Black Magic" 20/28/700; <640 chỉ ô logo), là link về `/`; phải là **một** link 14/20/500 `--fg-on-chrome` có icon 20px ("Quay lại giỏ hàng", "Quay lại"), cao 40px, padding `0 8px`, bo 8px, hover nền `--bg-chrome-hover`. Không có đường kẻ ở đáy.
- Vẫn có link "Bỏ qua tới nội dung chính", `<main id="main">` và `Footer`.
- Bấm logo khi đang điền form không hỏi lại (form ngắn, dữ liệu món đã lưu `sessionStorage`).

### 9.17 Nút và menu tài khoản (`AccountMenu`, ✅; mọi trang có header đầy đủ)
Thay cho link "Tài khoản" cũ trên header. Không có các mục ngoài phạm vi ([ngoai-pham-vi.md](ngoai-pham-vi.md)). Bản mẫu tương tác đã duyệt ngày 07/10/2026. Chỉ có ở header đầy đủ; header thu gọn (§9.16) **không có**.

**Nút trên header** (`<button>`, vị trí cũ của "Tài khoản", trước vạch ngăn và Giỏ hàng):

| Phần | Máy tính (≥1280) | Dưới 1280 |
|---|---|---|
| Hình dạng | như nút Đơn hàng (§9.1): cao 44px, padding `0 10px`, bo 10px, icon `User` 28 + nhãn 16/24/500 + mũi tên `ChevronDown` 16, gap 8px | ô 40×40, chỉ icon `User` 28, không nhãn, không mũi tên |
| Nhãn khi chưa đăng nhập | "Đăng nhập" | — |
| Nhãn khi đã đăng nhập | **username** (tên điền lúc tạo tài khoản, dang-nhap.md §3.2) | — |
| Bề rộng nhãn | **cố định bằng bề rộng chữ "Đăng nhập"** ở cùng cỡ chữ. Cách làm không cần số đo: nhãn là lưới 1 ô chứa một chữ "Đăng nhập" ẩn (`visibility:hidden`, `aria-hidden`) và tên thật chồng lên cùng ô; tên `white-space:nowrap; overflow:hidden` | — |
| Tên dài hơn ô | phần cuối mờ dần: `mask-image: linear-gradient(90deg, #000 62%, transparent)`, chỉ bật khi tên tràn (`scrollWidth > clientWidth`). Không có nút cuộn, không có dấu `…` (cách làm mờ mép chữ, không có thanh cuộn) | — |
| Đang mở | nền `--bg-chrome-hover`, viền trong 1px `--border-on-chrome`, mũi tên xoay 180° (200ms) | nền `--bg-chrome-hover` |
| ARIA | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; `aria-label` là "Đăng nhập" hoặc "Tài khoản của {username}" (để trình đọc màn hình đọc đủ tên dù chữ bị mờ) | như máy tính |

**Bảng thả xuống:**

| Phần | Giá trị |
|---|---|
| Vị trí | ≥1280: ngay dưới nút, cách 12px, mép phải bảng lệch phải 40px so với mép phải nút nhưng không vượt lề `--gutter`. Dưới 1280: rộng hết màn hình trừ lề 16px mỗi bên, ngay dưới hàng 1 của header |
| Khung | rộng 360px (tối đa `calc(100vw - 32px)`), `--bg-surface`, viền 1px `--border-divider`, bo 16px, `--shadow-lg`, padding `20px 24px 24px`; nằm trên vùng tối |
| Mũi nhọn | ô vuông 14px xoay 45°, nền `--bg-surface`, viền trái và trên `--border-divider`, ở mép trên bảng, thẳng giữa nút |
| Nút đóng | góc trên phải cách 12px, nút `ghost` vuông 40×40, icon `X` 24 `--fg-muted`, `aria-label="Đóng"` |
| Vùng tối | phủ **mọi thứ dưới header** (nội dung và footer), `--scrim`, hiện/ẩn 200ms. Header (cả hai hàng) không bị tối và vẫn bấm được. Khoá cuộn trang khi bảng mở |

Nội dung **khi chưa đăng nhập**:
- Đầu bảng: icon `UserRound` 28 `--fg-primary` + tiêu đề `<h2>` 18/26/600 "Đăng nhập để mua sắm dễ hơn", gap 12px.
- Danh sách lợi ích (cách 16px, mỗi dòng gap 10px): icon 20 `--fg-primary` + chữ 14/20 `--fg-muted`: `ShoppingCart` "Giỏ hàng lưu theo tài khoản"; `Package` "Theo dõi đơn hàng"; `Sparkles` "Gợi ý sản phẩm dành riêng cho bạn". Chỉ ghi điều có thật trong nghiệp vụ (giỏ tài khoản, lịch sử đơn, widget "Dành cho bạn").
- Hai nút ngang, chia đôi, gap 8px, cách 20px: "Đăng nhập" (`primary md`) → `/login`; "Tạo tài khoản" (`secondary md`) → `/register`. Cả hai mang `state.from` là trang đang xem.

Nội dung **khi đã đăng nhập**:
- Đầu bảng: icon `UserRound` 28 + "Xin chào," 14/20/500 `--fg-subdued`, username 16/24/600 (xuống dòng được, `overflow-wrap:anywhere`), email 12/18 `--fg-subdued`.
- Danh sách (`<ul>`, viền trên `--border-divider`, cách 16px, padding trên 12px): mỗi mục cao tối thiểu 44px, padding `0 8px`, bo 8px, icon 24 `--fg-muted` + chữ 16/24/500, gap 12px, hover nền `--bg-surface-raised`.
  - "Trang quản trị" (`LayoutDashboard`), **chỉ khi tài khoản thuộc nhóm `admin`**, dẫn tới trang admin (man-hinh-du-kien.md §16); sau mục này có đường kẻ 1px.
  - "Đăng xuất" (`LogOut`): đăng xuất (dang-nhap.md §8), gọi `notifyAuthChanged()`, đóng bảng. Đang ở trang bắt buộc đăng nhập (`/orders`, `/checkout`, trang admin) thì về `/`; trang khác ở nguyên chỗ.
- **Không** có "Đơn hàng của tôi": header đã có nút "Đơn hàng" ở mọi trang.

**Mở, đóng và focus:**
- Mở: bấm nút. Focus vào phần tử bấm được đầu tiên trong bảng (nút "Đăng nhập" hoặc mục đầu tiên).
- Đóng: bấm lại nút, nút ×, phím Esc, bấm vùng tối, Tab ra khỏi bảng, bấm một link khác trên header, hoặc đổi trang. Đóng bằng ×, Esc, vùng tối thì focus quay về nút.
- `role="dialog"`, `aria-modal="false"` (header vẫn dùng được), `aria-labelledby` trỏ tới tiêu đề hoặc dòng "Xin chào".
- Không mở khi rê chuột (chỉ bấm), để dùng được trên màn cảm ứng.

**Không có:** ảnh đại diện, trang hồ sơ, cài đặt tài khoản, phương thức thanh toán, danh sách yêu thích, hỗ trợ, quyền lợi "miễn phí vận chuyển" (mọi đơn đều miễn phí, ordering BR-06).

### 9.18 Menu danh mục (`CategoryMenu`, ✅; trang chủ và nút "Danh mục")
Theo kiểu menu danh mục cột trái của trang tham khảo. Một danh sách 13 loại hàng (`CATEGORIES`, cùng thứ tự với `CategoryIcon`), dùng ở 3 chỗ:

| Chỗ | Dạng |
|---|---|
| Trang chủ ≥1280 | **luôn hiện** ở cột trái hàng đầu trang (trang-chu.md §3.1) |
| Nút "Danh mục" trên header ≥1280 (mọi trang) | bảng thả xuống ngay dưới nút, cách 12px, cùng kiểu vùng tối và cách đóng như menu tài khoản (§9.17) |
| Nút menu trên header <1280 | ngăn kéo trượt từ trái, rộng `min(320px, 85vw)`, cao hết màn, nền `--bg-surface`, `--shadow-lg`, vùng tối `--scrim`; trên cùng có nút × và link "Đơn hàng" (icon `Package`), dưới là 13 loại hàng |

Hình dạng danh sách:
- Khung rộng 300px (trang chủ) hoặc 300px (bảng thả xuống), nền `--bg-surface`, viền 1px `--border-divider`, bo 12px, padding 8px.
- Mỗi mục là link tới `/products?category=…`: cao 36px, padding `4px 8px`, bo 8px, gap 12px; ô icon 28×28 nền `--bg-primary-tint-2`, bo 4px, `CategoryIcon` 20 `--fg-primary`; chữ 14/18/500 `--fg-heading`; `ChevronRight` 16 `--fg-icon-soft` sát phải.
- Hover nền `--bg-primary-tint`. Loại đang xem (`aria-current="page"`): nền `--bg-primary-tint-2`, chữ `--fg-primary` đậm 600.
- `<nav aria-label="Danh mục">` + `<ul>`.

Không có menu con nhiều tầng (không mở bảng con theo hãng, dòng máy khi rê chuột; Black Magic chỉ lọc theo loại, catalog BR-02). Bảng thả xuống và ngăn kéo là **suy luận**, chưa đối chiếu với trang tham khảo.

## 10. Token sẽ thêm khi cần

**Đã đưa vào `tokens.css` (đổi giao diện 11/10/2026):**
- Thêm: `--bg-subtle`, `--bg-chrome-strong`, `--bg-primary-tint-2`, `--fg-heading`, `--fg-icon-soft`, `--fg-price`, `--hero-ink`, `--radius-btn`, `--shadow-card-hover`, `--shadow-glass`, `--radius-2xl`, `--shadow-sm`.
- Đổi giá trị: mọi màu ở §2 (tím → chàm, nền và chữ theo bảng mới), bóng ở §4, `--font-sans` sang Inter, thang chữ ở §3.
- Bỏ: `--bg-image-plate` (thay bằng `--bg-subtle`), `--glow-primary` (nút chính chỉ tối đi khi hover), `--gradient-line`, `--bg-primary-tint-hover` (thay bằng `--bg-primary-tint-2`).
- `--radius-xl` đổi 16 → 12px. Chỗ đang bo 16px giữ nguyên bằng `--radius-2xl`; thẻ sản phẩm, menu danh mục, hero, ô thông tin chuyển sang `--radius-xl` khi làm lại các component đó.

Cần token mới khác thì ghi vào đây (tên, giá trị, khi nào dùng) trước, rồi thêm vào `tokens.css` trong cùng PR với chỗ dùng đầu tiên.
