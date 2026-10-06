# Design system: Black Magic

Người viết: Hoàng · Cập nhật: 06/10/2026 · Áp dụng cho `apps/web`

Tài liệu đầy đủ của hệ giao diện. Bản tóm tắt ở [giao-dien.md](giao-dien.md), mục lục ở [README.md](README.md).

- **Phạm vi:** chỉ những gì có trong tài liệu dự án (`docs/business/`, `project-plan.md`). Những tính năng cửa hàng điện tử lớn thường có nhưng dự án **không làm** được liệt kê ở [ngoai-pham-vi.md](ngoai-pham-vi.md).
- **Giá trị:** khớp `apps/web/src/styles/tokens.css` và `base.css`. Lệch thì code đúng; sửa tài liệu.
- **Đơn vị:** viết bằng px. Root font-size giữ mặc định của trình duyệt (16px).

---

## 1. Nguyên tắc

- **Nền tối là mặc định** (`data-theme="dark"`, chính là `:root`). Giao diện sáng bật bằng `data-theme="light"` trên `<html>`. **Header và footer luôn tối** ở cả hai giao diện.
- **Không ghi cứng mã màu trong component.** Chỉ dùng biến ngữ nghĩa `--bg-*`, `--fg-*`, `--border-*`. Ngoại lệ đã có: chữ trên header, footer và hero (vì các khối này không đổi theo theme).
- **Mỗi màu nhấn có một việc:**

  | Màu | Biến | Chỉ dùng cho |
  |---|---|---|
  | Tím | `--bg-primary`, `--fg-primary`, `--border-primary` | Hành động và trạng thái đang chọn: nút chính, link, chip/ô đang chọn, focus |
  | Cyan | `--fg-accent`, `--bg-accent-tint` | Điểm nhấn nhỏ (đường kẻ gradient, trạng thái "Đang giao") |
  | Vàng | `--bg-deal`, `--fg-deal` | **Chưa dùng trong MVP** (không có giảm giá, catalog BR-05). Giữ token để dành |
  | Xanh lá / đỏ / cam | `--fg-success`, `--fg-danger`, `--fg-warning` + nền `*-tint` | Trạng thái: còn hàng, lỗi, sắp hết, giá đã đổi |

  Không dùng tím để trang trí, để người dùng luôn biết chỗ nào bấm được. Mỗi màn hình chỉ có **một** nút tím chính.
- **Ảnh sản phẩm luôn nằm trên ô nền sáng** `--bg-image-plate` (`#F4F4F7`) với `mix-blend-mode: multiply`, vì ảnh của hãng có nền trắng.
- **Giá không tô đỏ**, luôn qua component `Price` (`24.990.000₫`).
- **Phân tách bằng độ sáng nền** (canvas → surface → raised) và viền 1px, không bằng bóng đổ. Bóng chỉ dùng cho thứ nổi lên (nút tròn, menu, hộp thoại).

## 2. Màu (token)

Giá trị lấy từ `tokens.css`. Cột "Tương phản" là tỉ lệ WCAG đã đo trên nền ghi bên cạnh.

### 2.1 Nền

| Token | Tối (mặc định) | Sáng | Dùng cho |
|---|---|---|---|
| `--bg-canvas` | `#0B0B0F` | `#F4F4F7` | Nền trang |
| `--bg-surface` | `#16161D` | `#FFFFFF` | Thẻ, khối nội dung |
| `--bg-surface-raised` | `#1F1F29` | `#FAFAFC` | Hover trên thẻ, ô nhập, nút phụ, ô trong khối |
| `--bg-surface-pressed` | `#2A2A36` | `#ECEBF2` | Nhấn, hover của nút phụ |
| `--bg-chrome` | `#111118` | (giữ tối) | Header, footer |
| `--bg-image-plate` | `#F4F4F7` | `#F4F4F7` | Ô nền ảnh sản phẩm |
| `--bg-primary` / `-hover` / `-pressed` | `#7C3AED` / `#854BF2` / `#6D28D9` | `#6D28D9` / `#7C3AED` / `#5B21B6` | Nút chính (chữ trắng: 5,70 / 4,90 / 7,10 ✓) |
| `--bg-primary-tint` | `rgba(124,58,237,.16)` | `#F5F3FF` | Nền mục đang chọn |
| `--bg-accent-tint` | `rgba(34,211,238,.12)` | (như tối) | Nhãn cyan |
| `--bg-success-tint` / `--bg-warning-tint` / `--bg-danger-tint` | `rgba(34,197,94,.14)` / `rgba(251,191,36,.14)` / `rgba(244,63,94,.14)` | (như tối) | Nền nhãn trạng thái |
| `--bg-transparent-hover` / `-pressed` | `rgba(255,255,255,.06)` / `.12` | `rgba(11,11,15,.04)` / `.08` | Hover và nhấn của nút trong suốt |
| `--scrim` | `rgba(0,0,0,.70)` | `rgba(11,11,15,.60)` | Nền mờ sau hộp thoại |
| `--bg-deal` | `#F5B83D` | `#F5B83D` | Để dành (sau MVP) |

### 2.2 Chữ và icon

| Token | Tối | Sáng | Tương phản (tối, trên `#16161D`) |
|---|---|---|---|
| `--fg-default` | `#F4F4F7` | `#0B0B0F` | 16,40 |
| `--fg-muted` | `#C9C9D3` | `#3B3A45` | 10,95 |
| `--fg-subdued` | `#A1A1AE` | `#6B6A78` | 7,05 |
| `--fg-placeholder` | `#8B8A97` | `#6B6A78` | 5,30 |
| `--fg-disabled` | `#6B6B78` | `#A1A1AE` | 3,43 (được miễn) |
| `--fg-on-primary` | `#FFFFFF` | `#FFFFFF` | trên nút tím |
| `--fg-primary` / `-hover` | `#A78BFA` / `#C4B5FD` | `#6D28D9` / `#5B21B6` | 6,61 / 9,75 |
| `--fg-accent` | `#22D3EE` | `#0E7490` | 9,96 |
| `--fg-success` | `#4ADE80` | `#15803D` | 10,33 |
| `--fg-warning` | `#FBBF24` | `#B45309` | 10,78 |
| `--fg-danger` | `#FB7185` | `#E11D48` | 6,69 |
| `--fg-deal` / `--fg-on-deal` | `#F5B83D` / `#0B0B0F` | `#B45309` / `#0B0B0F` | để dành |

### 2.3 Viền và focus

| Token | Tối | Sáng | Dùng cho |
|---|---|---|---|
| `--border-divider` | `#2A2A36` | `#E2E1EA` | Viền thẻ, đường kẻ (trang trí) |
| `--border-default` | `#3A3A48` | `#C9C9D3` | Viền nút phụ, chip, nút tròn |
| `--border-input` | `#6B6B78` | `#8E8C9B` | Ô nhập, checkbox (≥ 3:1 ✓) |
| `--border-primary` | `#8B5CF6` | `#7C3AED` | Mục đang chọn, ô nhập đang focus, hover có màu |
| `--focus-ring` | `#C4B5FD` | `#6D28D9` | Viền focus 2px |

### 2.4 Hiệu ứng thương hiệu

| Token | Giá trị | Dùng ở đâu |
|---|---|---|
| `--gradient-brand` | `linear-gradient(135deg, #2E1065 0%, #4C1D95 30%, #7C3AED 65%, #22D3EE 100%)` | **Chỉ** hero trang chủ và ô logo |
| `--gradient-line` | `linear-gradient(90deg, #7C3AED, #22D3EE)` | Đường kẻ 1px dưới hàng trên của header |
| `--glow-primary` | `0 0 0 1px rgba(139,92,246,.40), 0 8px 24px rgba(124,58,237,.35)` | Hover của nút chính quan trọng (nút tìm, nút hero). Không dùng cho thẻ sản phẩm |

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

**Bóng** (đã chỉnh cho nền tối):
| Token | Tối | Sáng | Dùng cho |
|---|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,.4)` | `0 2px 3px rgba(0,0,0,.05)` | Nút nổi nhẹ |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,.45)` | `0 2px 8px rgba(0,0,0,.12)` | Nút tròn ‹ › |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,.5)` | `0 4px 24px rgba(0,0,0,.12)` | Menu, hộp thoại |

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
| Nút chính | `--bg-primary-hover` (+ `--glow-primary` ở nút quan trọng) | viền focus | `--bg-primary-pressed` | opacity .4, `not-allowed` | — |
| Nút phụ (mặc định) | `--bg-surface-pressed` | viền focus | `--bg-surface-pressed` | chữ `--fg-disabled`, `not-allowed` | — |
| Nút trong suốt / link-nút | `--bg-transparent-hover` | viền focus | `--bg-transparent-pressed` | chữ `--fg-disabled` | — |
| Link | `--fg-primary-hover` + gạch chân | viền focus | — | — | `aria-current` → `--fg-primary` |
| Chip | viền `--border-primary` | viền focus | — | — | viền **2px** `--border-primary`, nền `--bg-primary-tint`, chữ `--fg-primary` (bớt 1px padding để chip không nhảy) |
| Thẻ sản phẩm | nền `--bg-surface-raised`, viền `--border-default` | viền focus quanh **cả thẻ** (`:focus-within`) | — | ô ảnh opacity .6 (hết hàng/ngừng bán) | — |
| Ô nhập, select | — | viền `--border-primary` + viền focus | — | chữ `--fg-disabled` | — |
| Nút tròn ‹ › | nền `--bg-surface-pressed`, viền `--border-primary` | hiện ra + viền focus | — | ẩn | — |

**Viền focus** (`base.css`, áp cho mọi phần tử): `outline: 2px solid var(--focus-ring); outline-offset: 2px`. Không bao giờ xoá outline mà không thay bằng viền khác. Trên nền gradient hero, viền focus màu trắng.

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
- Ảnh sản phẩm: ô vuông (`aspect-ratio: 1`), `object-fit: contain`, `mix-blend-mode: multiply` trên `--bg-image-plate`, `loading="lazy" decoding="async"` và có `width`/`height`. Không có ảnh → icon loại hàng 48px màu `#6B6B78` giữa ô.
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
| `Field` (nhãn + ô nhập/select + lỗi) | `shared/components/Field.tsx` | 📝 |
| `Checkbox` | `shared/components/Checkbox.tsx` | 📝 |
| `QuantityStepper` | `shared/components/QuantityStepper.tsx` | 📝 |
| `Badge` (tổng quát, gồm trạng thái đơn) | `shared/components/Badge.tsx` | 📝 |
| `Alert` (lỗi, cảnh báo, thành công) | `shared/components/Alert.tsx` | 📝 |
| `EmptyState` | `shared/components/EmptyState.tsx` | 📝 (đang viết trong trang danh sách) |
| `ConfirmDialog` | `shared/components/ConfirmDialog.tsx` | 📝 |
| `OrderSummary` (khối tóm tắt tiền) | `features/orders/components/OrderSummary.tsx` | 📝 (giỏ hàng, đặt hàng) |
| `FocusLayout` + `MiniHeader` | `app/FocusLayout.tsx` | 📝 (đặt hàng, đăng nhập, tạo tài khoản) |

### 9.1 Header (`app/Header`)
Dính đầu trang (`position: sticky; top: 0; z-index: 210`), nền `--bg-chrome`, chữ `#F4F4F7` cố định.

| Phần | Máy tính | Điện thoại (<640) |
|---|---|---|
| Hàng trên | padding `20px` dọc × lề ngang; mọi phần tử cao **48px**; chữ 16/20 → hàng cao ~88px | padding `12px 16px`; phần tử 40px; chữ 14/18 |
| Lề ngang | 24px → 32px (≥1200) → 48px (≥1600), trong khung `--content-max` | 16px |
| Logo | ô 48px nền `--gradient-brand` bo 8px + chữ "Black Magic" 28/36/700, `letter-spacing: -0.01em`; cả cụm là link về trang chủ | chữ 20/28 |
| Ô tìm kiếm | `role="search"`; ô nhập nền `#1F1F29`, viền `#3A3A48`, bo `8px 0 0 8px`, chữ 16px, `maxLength=30`, placeholder "Tìm laptop, card đồ hoạ, RAM…"; **nút tím** rộng 56px, bo `0 8px 8px 0`, icon 28, hover thêm glow. Từ 960px nằm cùng hàng với logo (co giãn chiếm chỗ trống), dưới 960px xuống hàng riêng | nút 48px, icon 24 |
| Đơn hàng, Tài khoản, Giỏ hàng | `NavLink` cao 48px, padding `0 8px`, bo 8px, icon 28 + nhãn (nhãn hiện từ 960px), đậm 500; hover nền `rgba(255,255,255,.06)`; trang hiện tại chữ `--fg-primary` | chỉ icon 24 |
| Đường kẻ | 1px `--gradient-line` dưới hàng trên, chạy hết chiều ngang | như máy tính |
| Hàng chip loại hàng | 13 chip (`CATEGORIES`), link tới `/products?category=…`; chip cao **44px**, padding `0 20px`, bo tròn, nền `#1F1F29`, viền `#3A3A48`, icon 20 + chữ 16/20/600, cách nhau 8px; hàng padding 16px dọc. Hover viền `--border-primary`. **Loại đang xem** (`aria-current="page"`): viền 2px tím, padding 19px, nền `--bg-primary-tint`, chữ `--fg-primary`. Đủ chỗ thì căn giữa; thiếu chỗ thì cuộn ngang, có mép mờ 48px và nút tròn 40px ‹ › (ẩn trên màn cảm ứng) | chip 36px, hàng padding 12px |

Gõ từ khoá rồi Enter → `/products?q=…` (bỏ khoảng trắng hai đầu, rỗng thì về `/products`). Ô tìm kiếm hiện lại từ khoá đang có trên URL.

### 9.2 Footer (`app/Footer`)
Nền `--bg-chrome`, viền trên 1px `--border-divider`, cách nội dung 48px; khung trong `padding: 32px var(--gutter)`; tên shop đậm 700 màu `#F4F4F7`, dòng ghi chú 12/18 màu `#A1A1AE`.

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
| `on-gradient` (chỉ hero) | `#FFFFFF` | không | `#2E1065` | nền `#F5F3FF` + glow |
| `on-gradient-outline` (chỉ hero) | trong suốt | `rgba(255,255,255,.4)` | `#FFFFFF` | nền `rgba(255,255,255,.12)` |

- `width: 100%` khi cần nút tràn ngang (thanh tổng tiền trên điện thoại).
- **Đang xử lý** (`aria-busy="true"`): giữ nguyên bề rộng, đổi chữ thành "Đang …" (ví dụ "Đang huỷ…", "Đang tải…"), chặn bấm lại.
- Mỗi màn hình chỉ một nút `primary`.

### 9.4 Ô nhập và select (`Field`, 📝)
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
| Select | cùng hình dạng; mũi tên mặc định của trình duyệt (được, vì nền tối có `color-scheme: dark`) |

- **Cỡ 48px** dùng cho form đặt hàng, đăng nhập, tạo tài khoản; 40px cho bộ lọc và chỗ khác.
- Dòng lỗi có icon `CircleAlert` 16px cùng màu đứng trước chữ, gap 4px.
- Luôn đặt `autocomplete` đúng nghĩa (`name`, `tel`, `email`, `username`, `current-password`, `new-password`, `one-time-code`…).
- **Ô mật khẩu (`PasswordField`)**: như ô nhập, `padding-right: 48px`; trong ô, sát phải cách 4px, nút `ghost` vuông 40×40 icon `Eye` / `EyeOff` 20px màu `--fg-subdued`, `aria-label` "Hiện mật khẩu" / "Ẩn mật khẩu", `aria-pressed`. Bấm chỉ đổi `type` giữa `password` và `text`, focus vẫn ở ô.

Form cụ thể ở [pages/dat-hang.md](pages/dat-hang.md) và [pages/dang-nhap.md](pages/dang-nhap.md).

### 9.5 Checkbox (`Checkbox`, 📝; dùng ở giỏ hàng để tick món)
20×20px, bo 4px, nền `--bg-surface-raised`, viền 1px `--border-input`. Được chọn: nền và viền `--bg-primary`, dấu tick trắng (lucide `Check` 14px). Hover: viền `--border-primary`. Focus: viền focus. Không chọn được (món hết hàng, ngừng bán, vượt tồn kho): opacity .4, `not-allowed`, kèm lý do bằng `StockBadge` cạnh tên món. Nhãn cách 8px; vùng bấm tối thiểu 40×40. Chọn một phần (`indeterminate`, ô "Chọn tất cả" ở giỏ): nền và viền `--bg-primary`, gạch ngang trắng (lucide `Minus` 14px).

### 9.6 Bộ chọn số lượng (`QuantityStepper`, 📝; trang chi tiết và giỏ hàng)
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
| Đang tải lần đầu (dải sản phẩm) | khung chờ đúng kích thước thẻ (cao 300px, bo 8px), gradient `#1F1F29 → #2A2A36` chạy 1,6s, `aria-hidden` |
| Đang tải (trang) | dòng "Đang tải …" màu `--fg-subdued` |
| Đang tải lại với bộ lọc mới | giữ kết quả cũ, lưới opacity .6, `aria-busy="true"` |
| Rỗng (`EmptyState`) | khung `--bg-surface`, viền `--border-divider`, **bo 16px**, padding `40px 16px`, chữ căn giữa; một câu giải thích + một link/nút đi tiếp |
| Lỗi tải | dòng chữ `--fg-subdued` "Chưa tải được … Tải lại trang để thử lần nữa.", `role="alert"` |
| Lỗi nghiệp vụ (`Alert`) | xem 9.13 |

### 9.13 Thông báo (`Alert`, 📝)
Khung bo 8px, padding `12px 16px`, viền trái 4px theo màu trạng thái, nền `*-tint` tương ứng, chữ 14/20 `--fg-default`, icon lucide 20px màu trạng thái bên trái (`CircleCheck`, `TriangleAlert`, `CircleX`).
| Loại | Ví dụ trong nghiệp vụ | Vai trò ARIA |
|---|---|---|
| success | "Đã thêm vào giỏ", "Đặt hàng thành công! Email xác nhận sẽ được gửi trong ít phút." | `status` |
| warning | `PRICE_CHANGED` ("Giá đã thay đổi. Vui lòng kiểm tra rồi bấm xác nhận lại."), `QUANTITY_LIMIT` | `alert` |
| danger | `OUT_OF_STOCK` (kèm danh sách món và số còn lại), `CART_FULL`, lỗi mạng, `CANNOT_CANCEL` | `alert` |

### 9.14 Hộp thoại xác nhận (`ConfirmDialog`, 📝; ví dụ "Huỷ đơn")
Dùng `<dialog>` gốc của trình duyệt (tự giữ focus, Esc để đóng). Rộng tối đa 480px (điện thoại: `calc(100% - 32px)`), nền `--bg-surface-raised`, viền 1px `--border-divider`, bo 16px, padding 24px, `--shadow-lg`; `::backdrop` là `--scrim`. Tiêu đề 20/28/600, nội dung 14/20 `--fg-muted`, hàng nút căn phải cách 24px: "Giữ đơn" (secondary) + "Huỷ đơn" (danger).

### 9.15 Tóm tắt đơn (`OrderSummary`, 📝; giỏ hàng, đặt hàng)
Khối `<section aria-labelledby>`: `--bg-surface`, viền `--border-divider`, bo 16px, padding 24px (<640: 16px).
- Tiêu đề `<h2>` 20/28/600, cách nội dung 16px. Nội dung riêng của trang (danh sách món ở trang đặt hàng) nằm ngay dưới tiêu đề.
- Các dòng tiền: `<dl>`, mỗi dòng `display:flex; justify-content:space-between; gap:16px`, 14/20, cách nhau 8px; nhãn `--fg-muted`, số `--fg-default` `tabular-nums`. "Phí vận chuyển" luôn là chữ "Miễn phí" màu `--fg-success`.
- Đường kẻ 1px `--border-divider` cách 16px trên dưới, rồi dòng **Tổng cộng**: nhãn 16/24/600, số là `Price md`.
- Dưới tổng, cách 24px: (tuỳ trang) `Alert`, rồi một `Button primary lg` rộng 100%, rồi chú thích 12/18 `--fg-subdued` (gap 8px).
- Không có dòng giảm giá, thuế, mã khuyến mãi, điểm thưởng, nút PayPal.

### 9.16 Bố cục tập trung (`FocusLayout` + `MiniHeader`, 📝; đặt hàng, đăng nhập, tạo tài khoản)
Thay `RootLayout` ở những trang khách cần tập trung hoàn tất một việc: bỏ ô tìm kiếm, hàng chip và các link điều hướng.
- `MiniHeader`: nền `--bg-chrome`, **không dính**, cao 64px (<640: 56px), khung `--content-max` với lề như header; trái là logo (ô 40px + chữ "Black Magic" 20/28/700; <640 chỉ ô logo), là link về `/`; phải là **một** link 14/20/500 màu `#F4F4F7` có icon 20px ("Quay lại giỏ hàng", "Quay lại"), cao 40px, padding `0 8px`, bo 8px, hover nền `rgba(255,255,255,.06)`. Đường kẻ `--gradient-line` 1px ở đáy như header.
- Vẫn có link "Bỏ qua tới nội dung chính", `<main id="main">` và `Footer`.
- Bấm logo khi đang điền form không hỏi lại (form ngắn, dữ liệu món đã lưu `sessionStorage`).

## 10. Token sẽ thêm khi cần

Chưa có trong `tokens.css` vì chưa có chỗ dùng. Thêm đúng giá trị này khi cần:

| Token | Giá trị | Khi nào |
|---|---|---|
| `--shadow-up` | tối `0 -2px 8px rgba(0,0,0,.5)` / sáng `0 -2px 8px rgba(11,11,15,.15)` | Thanh tổng tiền dính đáy màn hình (giỏ hàng trên điện thoại) |
