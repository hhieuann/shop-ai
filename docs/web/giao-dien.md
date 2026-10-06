# Giao diện web: Black Magic

Người viết: Hoàng · Ngày: 04/10/2026

Quy ước giao diện chung cho `apps/web`. Mọi giá trị nằm trong [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css); tài liệu này giải thích **khi nào dùng cái gì**. Ai làm thêm trang hay widget (ví dụ widget gợi ý, trang đăng nhập) đọc mục 1, 2 và 6 là đủ.

Đây là bản tóm tắt. Bản đầy đủ (mọi component, trạng thái, spec từng trang) nằm cùng thư mục: xem [README.md](README.md).

## 1. Nguyên tắc

- **Nền tối là mặc định.** Giao diện sáng bật bằng `data-theme="light"` trên `<html>`. Header luôn tối ở cả hai giao diện.
- **Không ghi cứng mã màu trong component.** Chỉ dùng biến ngữ nghĩa: `--bg-*`, `--fg-*`, `--border-*`. Đổi giao diện sáng hay đổi màu thương hiệu chỉ cần sửa `tokens.css`.
- **Mỗi màu nhấn có một việc:**

  | Màu | Biến | Chỉ dùng cho |
  |---|---|---|
  | Tím | `--bg-primary`, `--fg-primary` | Hành động: nút chính, link, ô đang chọn |
  | Cyan | `--fg-accent`, `--bg-accent-tint` | Điểm nhấn nhỏ, trạng thái "Đang giao" |
  | Vàng | `--bg-deal`, `--fg-deal` | Chưa dùng trong MVP (không có giảm giá) |
  | Xanh / đỏ / cam | `--fg-success`, `--fg-danger`, `--fg-warning` | Trạng thái: còn hàng, lỗi, sắp hết |

  Không dùng tím để trang trí, để người dùng luôn biết chỗ nào bấm được.
- **Ảnh sản phẩm đặt trên ô nền sáng** (`--bg-image-plate`), không đặt thẳng lên nền tối, vì ảnh của hãng thường có nền trắng.
- **Giá không tô đỏ.** Hiển thị bằng component `Price`: `24.990.000₫` (dấu chấm ngăn nghìn, ₫ sau số).

## 2. Chữ

Font **Be Vietnam Pro** (thiết kế cho tiếng Việt), dự phòng Inter, Segoe UI, Roboto. Line-height được nới so với thông thường để dấu tiếng Việt không bị cắt.

| Vai trò | Cỡ / line-height | Biến |
|---|---|---|
| Tiêu đề lớn trang chủ | 44 / 56 | `--text-display-sm` |
| Tiêu đề trang | 32 / 44 | `--text-headline-sm` |
| Tiêu đề khối | 24 / 32, 20 / 28 | `--text-title-md`, `--text-title-sm` |
| Nội dung | 16 / 24, 14 / 20 | `--text-body-lg`, `--text-body-md` |
| Chú thích | 12 / 18 | `--text-body-sm` |

## 3. Khoảng cách và bố cục

- Khoảng cách theo bậc 4px: `--space-50` (4px), `--space-100` (8px), `--space-200` (16px), `--space-300` (24px), `--space-400` (32px), `--space-600` (48px), `--space-800` (64px).
- Nội dung rộng tối đa `--content-max` (1920px), căn giữa. Lề hai bên `--gutter`: 16px (điện thoại) → 24px (≥640) → 40px (≥960) → 64px (≥1280).
- Bo góc: `--radius-md` (4px) cho nhãn/badge, `--radius-lg` (8px) cho nút, ô nhập và thẻ, `--radius-xl` (16px) cho khối lớn ở trang chủ.
- **Kiểm giao diện ở 3 cỡ màn hình:** 1920px, 1366px, 390px (điện thoại).

## 4. Component dùng chung

| Component | Ở đâu | Dùng khi |
|---|---|---|
| `Price` | `shared/components/Price.tsx` | Mọi chỗ hiện giá |
| `StoryBlock` | `shared/components/StoryBlock.tsx` | Một khối có tiêu đề trên trang chủ |
| `Carousel` | `shared/components/Carousel.tsx` | Dải cuộn ngang có nút ‹ › (tự ẩn nút ở hai đầu) |
| `ProductCard` | `features/catalog/components/ProductCard.tsx` | Thẻ sản phẩm trong lưới hoặc carousel |
| `StockBadge` | `features/catalog/components/StockBadge.tsx` | Nhãn còn hàng / chỉ còn N / hết hàng |

Style viết bằng **CSS Modules** (`*.module.css` cạnh component), không dùng thư viện UI. Icon dùng `lucide-react`.

## 5. Truy cập (accessibility)

- Mọi thứ bấm được phải dùng được bằng bàn phím, có viền focus `--focus-ring`.
- Có link "Bỏ qua tới nội dung chính" ở đầu trang.
- Tương phản chữ trên nền đạt WCAG AA (4.5:1 cho chữ thường). Các cặp màu trong `tokens.css` đã kiểm.
- Ảnh có `alt`; icon chỉ để trang trí thì `aria-hidden`.

## 6. Ghi chú cho phần của An

- **Widget gợi ý** ("Dành cho bạn", "Thường mua kèm"): bọc trong `StoryBlock`, hiện sản phẩm bằng `ProductCard` trong `Carousel`, giống các dải sản phẩm ở trang chủ. Như vậy tự khớp giao diện, không cần CSS riêng.
- **Đăng nhập:** trang `/login` hiện tại là trang **tạm** (nhập token giả để test giỏ hàng). Khi có Cognito, thay trang này và gọi `setTokenProvider()` trong `shared/auth/token.ts` với hàm trả về JWT; mọi request API sẽ tự gắn token.
