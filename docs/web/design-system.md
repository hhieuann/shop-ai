# Design system: Black Magic

Người viết: Hoàng · Cập nhật: 06/10/2026 · Áp dụng cho `apps/web`

Tài liệu đầy đủ của hệ giao diện. Bản tóm tắt ở [giao-dien.md](giao-dien.md), mục lục ở [README.md](README.md).

- **Phạm vi:** chỉ những gì có trong tài liệu dự án (`docs/business/`, `project-plan.md`). Những tính năng cửa hàng điện tử lớn thường có nhưng dự án **không làm** được liệt kê ở [ngoai-pham-vi.md](ngoai-pham-vi.md).
- **Giá trị:** khớp `apps/web/src/styles/tokens.css` và `base.css`. Lệch thì code đúng; sửa tài liệu.
- **Đổi bảng màu 06/10/2026:** chuyển từ nền tối "Midnight Violet" sang **nền sáng "Áo choàng phù thủy"** (issue #49). `tokens.css` và CSS của Header, Footer, trang chủ đã theo bảng màu mới.
- **Đơn vị:** viết bằng px. Root font-size giữ mặc định của trình duyệt (16px).

---

## 1. Nguyên tắc

- **Nền sáng là giao diện duy nhất** (bảng màu "Áo choàng phù thủy": nền trắng ngả tím, tím rực làm màu hành động). Không còn giao diện tối và thuộc tính `data-theme`.
- **Header và footer cùng một màu tím đậm** `--bg-chrome` (`#7E22CE`), chữ và icon trắng. Đây là "khung" thương hiệu bao lấy phần nội dung nền sáng, giúp nhận ra Black Magic ngay khi mở trang.
- **Không ghi cứng mã màu trong component.** Chỉ dùng biến ngữ nghĩa `--bg-*`, `--fg-*`, `--border-*`. Chữ trên header, footer và hero dùng token `--fg-on-chrome` (trắng), không ghi `#FFFFFF` trong CSS module.
- **Mỗi màu nhấn có một việc:**

  | Màu | Biến | Chỉ dùng cho |
  |---|---|---|
  | Tím (`#9333EA`, chữ tím `#7E22CE`) | `--bg-primary`, `--fg-primary`, `--border-primary` | Hành động và trạng thái đang chọn: nút chính, link, chip/ô đang chọn, focus. Tím đậm `#7E22CE` của header/footer là màu khung, không phải màu hành động |
  | Cyan (`#0E7490`) | `--fg-accent`, `--bg-accent-tint` | Điểm nhấn nhỏ (cuối gradient hero, trạng thái "Đang giao") |
  | Vàng | `--bg-deal`, `--fg-deal` | **Chưa dùng trong MVP** (không có giảm giá, catalog BR-05). Giữ token để dành |
  | Xanh lá / đỏ / cam | `--fg-success`, `--fg-danger`, `--fg-warning` + nền `*-tint` | Trạng thái: còn hàng, lỗi, sắp hết, giá đã đổi |

  Trong vùng nội dung, không dùng tím để trang trí, để người dùng luôn biết chỗ nào bấm được. Mỗi màn hình chỉ có **một** nút tím chính.
- **Ảnh sản phẩm luôn nằm trên ô nền nhạt** `--bg-image-plate` (`#F5F3FA`) với `mix-blend-mode: multiply`: ảnh của hãng có nền trắng, đặt thẳng lên thẻ trắng thì không thấy mép ảnh.
- **Giá không tô đỏ**, luôn qua component `Price` (`24.990.000₫`).
- **Phân tách bằng độ sáng nền** (canvas → surface → raised) và viền 1px, không bằng bóng đổ. Bóng chỉ dùng cho thứ nổi lên (nút tròn, menu, hộp thoại).

## 2. Màu (token)

Bảng màu "Áo choàng phù thủy" (06/10/2026). Cột "Tương phản" là tỉ lệ WCAG đã đo; chữ thường cần ≥ 4,5, viền ô nhập và focus ≥ 3.

### 2.1 Nền

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg-canvas` | `#F7F5FC` | Nền trang (trắng ngả tím) |
| `--bg-surface` | `#FFFFFF` | Thẻ, khối nội dung |
| `--bg-surface-raised` | `#FAF8FE` | Hover trên thẻ, ô nhập, nút phụ, ô trong khối |
| `--bg-surface-pressed` | `#EFEAFB` | Nhấn, hover của nút phụ |
| `--bg-chrome` | `#7E22CE` | **Header và footer** (chữ trắng 6,98) |
| `--bg-chrome-hover` | `rgba(255,255,255,.12)` | Hover của link, chip trên header |
| `--bg-image-plate` | `#F5F3FA` | Ô nền ảnh sản phẩm |
| `--bg-primary` / `-hover` / `-pressed` | `#9333EA` / `#7E22CE` / `#6B21A8` | Nút chính; hover và nhấn **tối đi** (chữ trắng: 5,38 / 6,98 / 8,72) |
| `--bg-primary-tint` / `-tint-hover` | `#F3E8FF` / `#E9D5FF` | Nền mục đang chọn, nút tìm trên header (hover: `-tint-hover`) |
| `--bg-accent-tint` | `#CFFAFE` | Nhãn cyan |
| `--bg-success-tint` / `--bg-warning-tint` / `--bg-danger-tint` | `#DCFCE7` / `#FEF3C7` / `#FFE4E6` | Nền nhãn trạng thái |
| `--bg-transparent-hover` / `-pressed` | `rgba(30,21,48,.04)` / `.08` | Hover và nhấn của nút trong suốt |
| `--scrim` | `rgba(30,21,48,.55)` | Nền mờ sau hộp thoại |
| `--bg-deal` | `#F5B83D` | Để dành (sau MVP) |

### 2.2 Chữ và icon

| Token | Giá trị | Tương phản |
|---|---|---|
| `--fg-default` | `#1E1530` (đen ngả tím) | 17,43 trên trắng |
| `--fg-muted` | `#4A3F5C` | 9,74 |
| `--fg-subdued` | `#6B6280` | 5,70 (5,41 trên `--bg-surface-raised`) |
| `--fg-placeholder` | `#756C88` | 4,68 trên ô nhập |
| `--fg-disabled` | `#A9A1B8` | 2,48 (được miễn) |
| `--fg-on-primary` | `#FFFFFF` | trên nút tím |
| `--fg-on-chrome` / `--fg-on-chrome-muted` | `#FFFFFF` / `#E9D5FF` | 6,98 / 5,13 trên header, footer |
| `--fg-primary` / `-hover` | `#7E22CE` / `#6B21A8` | 6,98 / 8,72 |
| `--fg-accent` | `#0E7490` | 5,36 (4,79 trên `#CFFAFE`) |
| `--fg-success` | `#15803D` | 5,02 (4,57 trên `#DCFCE7`) |
| `--fg-warning` | `#B45309` | 5,02 (4,51 trên `#FEF3C7`) |
| `--fg-danger` | `#BE123C` | 6,29 (5,24 trên `#FFE4E6`) |
| `--fg-deal` / `--fg-on-deal` | `#B45309` / `#1E1530` | để dành |

### 2.3 Viền và focus

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--border-divider` | `#E9E4F2` | Viền thẻ, đường kẻ (trang trí) |
| `--border-default` | `#D6CEE6` | Viền nút phụ, chip, nút tròn, vòng danh mục |
| `--border-input` | `#8C82A0` | Ô nhập, checkbox (3,43 trên ô nhập ✓) |
| `--border-primary` | `#9333EA` | Mục đang chọn, ô nhập đang focus, hover có màu |
| `--border-on-chrome` / `-subtle` | `rgba(255,255,255,.38)` / `.22` | Viền chip trên header / đường kẻ dưới hàng trên |
| `--focus-ring` / `--focus-ring-on-chrome` | `#9333EA` / `#FFFFFF` | Viền focus 2px (5,38). Trên header, footer và hero dùng `--focus-ring-on-chrome` (trắng) |

### 2.4 Hiệu ứng thương hiệu

| Token | Giá trị | Dùng ở đâu |
|---|---|---|
| `--gradient-brand` | `linear-gradient(135deg, #3B0764 0%, #6B21A8 35%, #9333EA 70%, #22D3EE 100%)` | **Chỉ** hero trang chủ. Chữ trắng chỉ đặt trên khoảng 60% phía tối (trái, trên) |
| `--gradient-logo` | `linear-gradient(135deg, #F0ABFC, #FFFFFF)` | Ô logo trên header tím |
| `--glow-primary` | `0 0 0 1px rgba(147,51,234,.30), 0 6px 16px rgba(147,51,234,.25)` | Hover của nút chính quan trọng (nút hero, "Thêm vào giỏ"). Không dùng cho thẻ sản phẩm |

`--gradient-line` (đường kẻ tím–cyan dưới header) **bỏ**: trên nền header tím, đường kẻ dùng `--border-on-chrome-subtle`.

## 3. Chữ

Font **Be Vietnam Pro** (`--font-sans`, dự phòng Inter, Segoe UI, Roboto, system-ui), tải kèm subset `vietnamese`. Số liệu kỹ thuật (thông số, mã) có thể dùng `--font-mono` (JetBrains Mono). `<html lang="vi">`.

Line-height để rộng để dấu chồng (ệ, ẫ, Ữ) không bị cắt.

| Vai trò | Token cỡ / line-height | Giá trị | Đậm | Dùng ở |
|---|---|---|---|---|
| Tiêu đề hero (≥1280) | `--text-display-sm` / `--leading-display-sm` | 44 / 56 | 600 | Hero trang chủ |
| Tiêu đề trang, hero (<1280), giá lớn | `--text-headline-sm` / `--leading-headline-sm` | 32 / 44 | 600 | `Price lg` |
| Tiêu đề trang danh sách | `--text-title-md` / `--leading-title-md` | 24 / 32 | 600 | H1 trang `/products` |
| Tiêu đề khối, giá thẻ | `--text-title-sm` / `--leading-title-sm` | 20 / 28 | 600 | `StoryBlock`, `Price md` |
| Nội dung lớn | `--text-body-lg` / `--leading-body-lg` | 16 / 24 | 400 | Đoạn văn hero, ô nhu cầu |
| **Nội dung mặc định** | `--text-body-md` / `--leading-body-md` | **14 / 20** | 400 | `body`, nút, tên sản phẩm (500) |
| Chú thích | `--text-body-sm` / `--leading-body-sm` | 12 / 18 | 400–500 | Hãng, nhãn, chú thích ô nhập |

Quy tắc:
- Độ đậm: **400** nội dung, **500** nhấn nhẹ (tên sản phẩm, link hành động, nhãn ô nhập), **600** tiêu đề, chip header và nút, **700** chỉ cho giá và logo.
- `h1`, `h2`, `h3` mặc định 600, margin 0 (`base.css`).
- **Không viết hoa toàn bộ** tiêu đề tiếng Việt.
- Giá, số lượng, tổng tiền: `font-variant-numeric: tabular-nums` (class `.tabular`).
- Cắt chữ nhiều dòng bằng `-webkit-line-clamp` và luôn kèm `min-height` giữ chỗ (2 dòng × 20px = 40px) để các thẻ cùng hàng thẳng nhau.
- Ô nhập trên điện thoại dùng cỡ chữ **≥ 16px** để iOS không tự phóng to.

## 4. Khoảng cách, bo góc, bóng, chuyển động

**Khoảng cách** (bậc 4/8px): `--space-25` 2 · `--space-50` 4 · `--space-100` 8 · `--space-150` 12 · `--space-200` 16 · `--space-300` 24 · `--space-400` 32 · `--space-500` 40 · `--space-600` 48 · `--space-800` 64. Không dùng giá trị ngoài bảng.

Hay dùng nhất: **16** (khoảng cách giữa các khối, giữa thẻ trong lưới, padding thẻ lớn), **8** (khoảng cách trong danh sách, giữa thẻ trong carousel), **24** (padding khối từ 640px), **4** (chữ xếp chồng).

**Bo góc:**
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--radius-sm` | 2px | (ít dùng) |
| `--radius-md` | 4px | Nhãn, badge |
| `--radius-lg` | 8px | **Nút, ô nhập, select, thẻ sản phẩm, ô ảnh, ô trong khối** |
| `--radius-xl` | 16px | Khối lớn: `StoryBlock`, hero, ô trạng thái rỗng |
| `--radius-full` | 9999px | Chip, nút tròn |
| `50%` | | Vòng tròn danh mục |

Quy tắc lồng: khối 16px chứa phần tử 8px; phần tử 8px chứa nhãn 4px.

**Bóng** (nhẹ, cho nền sáng):
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--shadow-xs` | `0 2px 3px rgba(30,21,48,.05)` | Nút nổi nhẹ |
| `--shadow-md` | `0 2px 8px rgba(30,21,48,.10)` | Nút tròn ‹ › |
| `--shadow-lg` | `0 4px 24px rgba(30,21,48,.12)` | Menu, hộp thoại |
| `--shadow-up` | `0 -2px 8px rgba(30,21,48,.12)` | Thanh tổng tiền dính đáy màn hình (giỏ hàng trên điện thoại) |

**Chuyển động:** `--dur-fast` 150ms (màu nền, viền), `--dur-base` 200ms (ô nhập, xoay icon), `--dur-medium` 300ms (hiện/ẩn nút carousel); easing `--ease-standard` `cubic-bezier(0,0,.2,1)` hoặc `ease-out`. `base.css` đã tắt toàn bộ animation khi `prefers-reduced-motion: reduce`. Không có hiệu ứng phóng to hay nhấc thẻ khi hover.

## 5. Bố cục và responsive

| Thứ | Giá trị |
|---|---|
| Bề rộng nội dung tối đa | `--content-max` **1920px**, căn giữa |
| Lề hai bên `--gutter` | 16px (<640) → 24px (≥640) → 40px (≥960) → 64px (≥1280) |
| Vùng `<main>` | `padding: 16px var(--gutter) 0`, footer cách 48px |
| Breakpoint | **640** (điện thoại → máy tính bảng), **960** (bố cục máy tính), **1280** (màn rộng); header dùng thêm 1200 và 1600 cho lề |
| Màn kiểm thử | 1920px, 1366px, 390px |
| Khung hẹp | Giỏ hàng, đặt hàng: rộng tối đa **1280px**, căn giữa trong lề `--gutter` |
| Bố cục hai cột (≥960) | Trang chi tiết, giỏ hàng, đặt hàng: `grid-template-columns: minmax(0,1fr) 360px; gap:24px; align-items:start`. Cột phải 360px là hộp mua hoặc `OrderSummary`. Dưới 960px xếp một cột |

Quy tắc:
- Thiết kế từ điện thoại lên (`min-width`). Dưới 960px các hàng nhiều cột xếp thành một cột.
- Lưới sản phẩm tự chia cột theo bề rộng (`auto-fill`, xem file trang), không cố định số cột.
- Mọi phần tử con của flex chứa carousel hoặc chữ bị cắt phải có `min-width: 0`.
- Màn cảm ứng (`@media (hover: none)`): ẩn nút ‹ ›, người dùng vuốt.

## 6. Trạng thái tương tác

| Thành phần | Hover | Focus bàn phím | Nhấn | Vô hiệu | Đang chọn |
|---|---|---|---|---|---|
| Nút chính | `--bg-primary-hover` (tối hơn; + `--glow-primary` ở nút quan trọng) | viền focus | `--bg-primary-pressed` | opacity .4, `not-allowed` | — |
| Nút phụ (mặc định) | `--bg-surface-pressed` | viền focus | `--bg-surface-pressed` | chữ `--fg-disabled`, `not-allowed` | — |
| Nút trong suốt / link-nút | `--bg-transparent-hover` | viền focus | `--bg-transparent-pressed` | chữ `--fg-disabled` | — |
| Link | `--fg-primary-hover` + gạch chân | viền focus | — | — | `aria-current` → `--fg-primary` |
| Chip | viền `--border-primary` | viền focus | — | — | viền **2px** `--border-primary`, nền `--bg-primary-tint`, chữ `--fg-primary` (bớt 1px padding để chip không nhảy) |
| Thẻ sản phẩm | nền `--bg-surface-raised`, viền `--border-default` | viền focus quanh **cả thẻ** (`:focus-within`) | — | ô ảnh opacity .6 (hết hàng/ngừng bán) | — |
| Ô nhập, select | — | viền `--border-primary` + viền focus | — | chữ `--fg-disabled` | — |
| Nút tròn ‹ › | nền `--bg-surface-pressed`, viền `--border-primary` | hiện ra + viền focus | — | ẩn | — |

**Viền focus** (`base.css`, áp cho mọi phần tử): `outline: 2px solid var(--focus-ring); outline-offset: 2px`. Không bao giờ xoá outline mà không thay bằng viền khác. Trên header, footer và hero (nền tím), viền focus màu trắng.

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
- Ảnh sản phẩm: ô vuông (`aspect-ratio: 1`), `object-fit: contain`, `mix-blend-mode: multiply` trên `--bg-image-plate`, `loading="lazy" decoding="async"` và có `width`/`height`. Không có ảnh → icon loại hàng 48px màu `--border-input` (`#8C82A0`) giữa ô.
- `alt=""` khi tên sản phẩm đã có ngay cạnh ảnh (tránh đọc lặp).

## 9. Component dùng chung

Cột "Trạng thái": ✅ đã có trong code, 📝 chưa làm thành component riêng (đang viết trực tiếp trong trang, nên tách ra theo spec này khi sửa trang đó).

| Component | Vị trí | Trạng thái |
|---|---|---|
| Header, Footer, RootLayout | `app/` | ✅ |
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

### 9.1 Header (`app/Header`)
Dính đầu trang (`position: sticky; top: 0; z-index: 210`), nền `--bg-chrome` (tím đậm `#7E22CE`), chữ và icon `--fg-on-chrome` (trắng). Kích thước không đổi so với bản trước.

| Phần | Máy tính | Điện thoại (<640) |
|---|---|---|
| Hàng trên | padding `20px` dọc × lề ngang; mọi phần tử cao **48px**; chữ 16/20 → hàng cao ~88px | padding `12px 16px`; phần tử 40px; chữ 14/18 |
| Lề ngang | 24px → 32px (≥1200) → 48px (≥1600), trong khung `--content-max` | 16px |
| Logo | ô 48px nền `--gradient-logo` bo 8px + chữ "Black Magic" 28/36/700 trắng, `letter-spacing: -0.01em`; cả cụm là link về trang chủ | chữ 20/28 |
| Ô tìm kiếm | `role="search"`; ô nhập **nền trắng**, không viền, chữ `--fg-default`, placeholder `--fg-placeholder`, bo `8px 0 0 8px`, chữ 16px, `maxLength=30`, placeholder "Tìm laptop, card đồ hoạ, RAM…"; **nút tìm nền `--bg-primary-tint`** (`#F3E8FF`), icon `--fg-primary-hover` (`#6B21A8`, 7,39), rộng 56px, bo `0 8px 8px 0`, icon 28, hover nền `--bg-primary-tint-hover` (`#E9D5FF`). Nút tím rực đặt trên header tím sẽ chìm, nên nút tìm dùng nền nhạt. Focus: viền trắng. Từ 960px nằm cùng hàng với logo (co giãn chiếm chỗ trống), dưới 960px xuống hàng riêng | nút 48px, icon 24 |
| Đơn hàng | `NavLink` cao 48px, padding `0 8px`, bo 8px, icon 28 + nhãn (nhãn hiện từ 960px), đậm 500; hover nền `--bg-chrome-hover`; trang hiện tại gạch chân 2px trắng dưới nhãn | chỉ icon 24 |
| Tài khoản | **nút** "Đăng nhập" hoặc username, mở menu tài khoản (§9.17); không còn là link tới `/login` | chỉ icon 24 |
| Vạch ngăn | sau nút tài khoản: vạch dọc 1px × 32px `--border-on-chrome`, cách hai bên 8px | cao 24px, cách 4px |
| Giỏ hàng | **chỉ icon** `ShoppingCart` **32px**, không nhãn (`aria-label="Giỏ hàng"`), ô vuông 48×48; hover nền `--bg-chrome-hover`; trang hiện tại có vạch trắng 2px dưới icon | icon 28 |
| Đường kẻ | 1px `--border-on-chrome-subtle` dưới hàng trên, chạy hết chiều ngang | như máy tính |
| Hàng chip loại hàng | 13 chip (`CATEGORIES`), link tới `/products?category=…`; chip cao **44px**, padding `0 20px`, bo tròn, nền trong suốt, viền `--border-on-chrome`, chữ và icon trắng, icon 20 + chữ 16/20/600, cách nhau 8px; hàng nằm trên cùng nền tím, padding 16px dọc. Hover nền `--bg-chrome-hover`. **Loại đang xem** (`aria-current="page"`): nền trắng, chữ và icon `--fg-primary-hover`, viền 2px trắng, padding 19px. Đủ chỗ thì căn giữa; thiếu chỗ thì cuộn ngang, có mép mờ 48px (màu `--bg-chrome`) và nút tròn 40px ‹ › (ẩn trên màn cảm ứng) | chip 36px, hàng padding 12px |

Gõ từ khoá rồi Enter → `/products?q=…` (bỏ khoảng trắng hai đầu, rỗng thì về `/products`). Ô tìm kiếm hiện lại từ khoá đang có trên URL.

### 9.2 Footer (`app/Footer`)
**Cùng màu với header**: nền `--bg-chrome` (`#7E22CE`), không viền, cách nội dung 48px; khung trong `padding: 32px var(--gutter)`; tên shop đậm 700 `--fg-on-chrome` (trắng), dòng ghi chú 12/18 `--fg-on-chrome-muted` (`#E9D5FF`, 5,13). Link (nếu có) màu trắng, gạch chân khi hover; viền focus trắng.

### 9.3 Nút (`Button`, 📝)
Hình dạng chung: `display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid; border-radius:8px`, chữ 14/20 **600** một dòng. (`base.css` hiện cho mọi `<button>` kiểu nút phụ, chữ 400; khi tách component `Button` thì dùng 600.)

| Cỡ | Chiều cao tối thiểu | Padding | Dùng cho |
|---|---|---|---|
| `sm` | 32px | `4px 12px` | Nút phụ trong dòng (Xoá trong giỏ, nút ± của bộ chọn số lượng dùng ô vuông 40px) |
| `md` | 40px | `8px 16px` | Mặc định: "Xem thêm sản phẩm", "Quay lại", nút trong form |
| `lg` | 48px | `8px 24px` | Hành động chính của trang: "Thêm vào giỏ", "Đặt hàng", "Xác nhận đặt hàng", nút hero |

| Biến thể | Nền | Viền | Chữ | Hover / nhấn |
|---|---|---|---|---|
| `primary` | `--bg-primary` | `--bg-primary` | `--fg-on-primary` | `-hover` + glow / `-pressed` |
| `secondary` (mặc định) | `--bg-surface-raised` | `--border-default` | `--fg-default` | `--bg-surface-pressed` |
| `ghost` | trong suốt | trong suốt | `--fg-primary` | `--bg-transparent-hover` / `-pressed` |
| `danger` (Huỷ đơn, Xoá) | `--bg-surface-raised` | `--border-default` | `--fg-danger` | nền `--bg-danger-tint` |
| `on-gradient` (chỉ hero) | `#FFFFFF` | không | `#3B0764` | nền `#F3E8FF` + glow |
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
`24.990.000₫` (dấu chấm ngăn nghìn, ₫ sau số, không cách) qua `formatVnd`; đậm 700, `tabular-nums`, không xuống dòng, màu `--fg-default`, **không tô đỏ**. Trình đọc màn hình nghe "24.990.000 đồng".

| Cỡ | Số | ₫ | Dùng ở |
|---|---|---|---|
| `md` (mặc định) | 20/28 | 14px | Thẻ sản phẩm, dòng giỏ hàng, tóm tắt đơn |
| `lg` | 32/44 | 16px | Trang chi tiết, tổng tiền đặt hàng |

Không có giá cũ, phần trăm giảm hay "tiết kiệm" (catalog BR-05). Phí vận chuyển hiển thị chữ "Miễn phí" (ordering BR-06), không phải "0₫".

### 9.9 Thẻ sản phẩm (`ProductCard` ✅)
Dùng ở mọi lưới và carousel. Một kiểu duy nhất.

| Phần | Giá trị |
|---|---|
| Thẻ | `--bg-surface`, viền 1px `--border-divider`, bo 8px, padding 8px, `display:flex; flex-direction:column; height:100%` |
| Hover | nền `--bg-surface-raised`, viền `--border-default` (150ms) |
| Bấm | cả thẻ bấm được nhờ `::after` của link tiêu đề phủ kín thẻ; chỉ tiêu đề là link thật |
| Focus | viền focus quanh cả thẻ (`:focus-within`) |
| Ô ảnh | vuông, `--bg-image-plate`, bo 8px; ảnh 84% × 84%, contain, multiply, lazy, 168×168 |
| Phần chữ | `padding: 12px 4px 4px; gap: 4px` |
| Tên | `<h3>`, 14/20/**500**, tối đa **2 dòng**, `min-height: 40px` |
| Hãng | dòng riêng dưới tên, 12/18 `--fg-subdued` |
| Chân thẻ | đẩy xuống đáy (`margin-top:auto`), cách 8px; `Price md` bên trái, `StockBadge` bên phải, tự xuống dòng khi hẹp |
| Hết hàng / ngừng bán | ô ảnh opacity .6, vẫn bấm vào xem được |

Thẻ **không có** nút "Thêm vào giỏ", nút lưu, ô so sánh, sao đánh giá, nhãn giảm giá. Thêm vào giỏ làm ở trang chi tiết.

### 9.10 Khối nội dung (`StoryBlock` ✅)
`<section aria-labelledby>` nền `--bg-surface`, viền 1px `--border-divider`, bo 16px, `overflow:hidden`.
- Đầu khối: `flex`, gap 8px, padding 16px (≥640: `24px 24px 16px`).
- Tiêu đề `<h2>` 20/28/600; phụ đề tuỳ chọn `--fg-subdued`, cách 2px.
- Link hành động tuỳ chọn ("Xem tất cả") đẩy sang phải, đậm 500, không xuống dòng.
- Nội dung bên dưới tràn sát viền khối (carousel tự có padding).

### 9.11 Dải cuộn ngang (`Carousel` ✅)
- Track: `display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x mandatory`, ẩn thanh cuộn; padding `0 16px 16px` (≥640: `0 24px 24px`), `scroll-padding-inline` bằng padding ngang. Ô: `flex-shrink:0; scroll-snap-align:start`.
- `centered`: đủ chỗ thì căn giữa (dùng `margin:auto` ở ô đầu và cuối, không dùng `justify-content:center`).
- Nút ‹ ›: tròn **40px**, cách mép 8px, ngang giữa track, nền `--bg-surface-raised`, viền `--border-default`, `--shadow-md`, icon 24. Ẩn (opacity 0) tới khi rê chuột vào dải hoặc focus bằng bàn phím (300ms); chỉ hiện ở hướng còn nội dung; hover nền `--bg-surface-pressed` + viền tím; **ẩn hẳn trên màn cảm ứng**.
- Không tự chạy, không có chấm phân trang.
- Ô sản phẩm trong dải: rộng `min(42vw, 184px)`, từ 768px là 192px.

### 9.12 Trạng thái tải, rỗng, lỗi
| Trạng thái | Cách hiển thị |
|---|---|
| Đang tải lần đầu (dải sản phẩm) | khung chờ đúng kích thước thẻ (cao 300px, bo 8px), gradient `#EFEAFB → #F7F5FC` chạy 1,6s, `aria-hidden` |
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
Thay `RootLayout` ở những trang khách cần tập trung hoàn tất một việc: bỏ ô tìm kiếm, hàng chip và các link điều hướng.
- `MiniHeader`: nền `--bg-chrome`, **không dính**, **không có nút tài khoản** (§9.17), cao 64px (<640: 56px), khung `--content-max` với lề như header; trái là logo (ô 40px + chữ "Black Magic" 20/28/700; <640 chỉ ô logo), là link về `/`; phải là **một** link 14/20/500 `--fg-on-chrome` có icon 20px ("Quay lại giỏ hàng", "Quay lại"), cao 40px, padding `0 8px`, bo 8px, hover nền `--bg-chrome-hover`. Không có đường kẻ ở đáy.
- Vẫn có link "Bỏ qua tới nội dung chính", `<main id="main">` và `Footer`.
- Bấm logo khi đang điền form không hỏi lại (form ngắn, dữ liệu món đã lưu `sessionStorage`).

### 9.17 Nút và menu tài khoản (`AccountMenu`, ✅; mọi trang có header đầy đủ)
Thay cho link "Tài khoản" cũ trên header. Không có các mục ngoài phạm vi ([ngoai-pham-vi.md](ngoai-pham-vi.md)). Bản mẫu tương tác đã duyệt ngày 07/10/2026. Chỉ có ở header đầy đủ; header thu gọn (§9.16) **không có**.

**Nút trên header** (`<button>`, vị trí cũ của "Tài khoản", trước vạch ngăn và Giỏ hàng):

| Phần | Máy tính (≥960) | Dưới 960 |
|---|---|---|
| Hình dạng | như link header: cao 48px, padding `0 8px`, bo 8px, icon `User` 28 + nhãn 16/20/500 + mũi tên `ChevronDown` 16, gap 8px | chỉ icon `User` (28; <640: 24), không nhãn, không mũi tên |
| Nhãn khi chưa đăng nhập | "Đăng nhập" | — |
| Nhãn khi đã đăng nhập | **username** (tên điền lúc tạo tài khoản, dang-nhap.md §3.2) | — |
| Bề rộng nhãn | **cố định bằng bề rộng chữ "Đăng nhập"** ở cùng cỡ chữ. Cách làm không cần số đo: nhãn là lưới 1 ô chứa một chữ "Đăng nhập" ẩn (`visibility:hidden`, `aria-hidden`) và tên thật chồng lên cùng ô; tên `white-space:nowrap; overflow:hidden` | — |
| Tên dài hơn ô | phần cuối mờ dần: `mask-image: linear-gradient(90deg, #000 62%, transparent)`, chỉ bật khi tên tràn (`scrollWidth > clientWidth`). Không có nút cuộn, không có dấu `…` (cùng cách làm mờ như mép hàng chip, §9.1) | — |
| Đang mở | nền `--bg-chrome-hover`, viền trong 1px `--border-on-chrome`, mũi tên xoay 180° (200ms) | nền `--bg-chrome-hover` |
| ARIA | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; `aria-label` là "Đăng nhập" hoặc "Tài khoản của {username}" (để trình đọc màn hình đọc đủ tên dù chữ bị mờ) | như máy tính |

**Bảng thả xuống:**

| Phần | Giá trị |
|---|---|
| Vị trí | ≥960: ngay dưới nút, cách 12px, mép phải bảng lệch phải 40px so với mép phải nút nhưng không vượt lề `--gutter`. Dưới 960: rộng hết màn hình trừ lề 16px mỗi bên, ngay dưới hàng trên của header |
| Khung | rộng 360px (tối đa `calc(100vw - 32px)`), `--bg-surface`, viền 1px `--border-divider`, bo 16px, `--shadow-lg`, padding `20px 24px 24px`; nằm trên vùng tối |
| Mũi nhọn | ô vuông 14px xoay 45°, nền `--bg-surface`, viền trái và trên `--border-divider`, ở mép trên bảng, thẳng giữa nút |
| Nút đóng | góc trên phải cách 12px, nút `ghost` vuông 40×40, icon `X` 24 `--fg-muted`, `aria-label="Đóng"` |
| Vùng tối | phủ **mọi thứ dưới header** (nội dung và footer), `--scrim`, hiện/ẩn 200ms. Header (kể cả hàng chip) không bị tối và vẫn bấm được. Khoá cuộn trang khi bảng mở |

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

## 10. Token sẽ thêm khi cần

Hiện chưa có token nào chờ thêm. Cần token mới thì ghi vào đây (tên, giá trị, khi nào dùng) trước, rồi thêm vào `tokens.css` trong cùng PR với chỗ dùng đầu tiên.
