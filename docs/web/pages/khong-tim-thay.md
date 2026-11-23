# Không tìm thấy trang (route `*`)

Code: `shared/components/NotFoundPage.tsx`, route `path: '*'` trong `router.tsx`. Đọc kèm [design-system.md](../design-system.md) (§9.3, §9.12).

Bản chốt 10/11/2026. Trang hiện khi đường dẫn không khớp route nào của web (vd. `/khuyen-mai`, `/products/abc/xyz`, link cũ). Khác với 404 **trong** một trang (sản phẩm không tồn tại ở [chi-tiet-san-pham.md](chi-tiet-san-pham.md) mục 4, đơn không tồn tại ở [don-hang.md](don-hang.md) mục 5): những chỗ đó route có thật, API trả 404, trang tự hiện khối rỗng riêng và giữ nguyên.

## 1. Đường dẫn và dữ liệu

- Không gọi API, không cần đăng nhập. Đã đăng nhập hay chưa thì trang giống nhau (header tự đổi nút tài khoản như mọi trang).
- Web là SPA: máy chủ luôn trả `index.html` với HTTP 200, router mới biết đường dẫn lạ. Không đổi hạ tầng để trả mã 404 (mục 6).

## 2. Bố cục

```
[ Header đầy đủ: logo, Danh mục, ô tìm kiếm, Đơn hàng, tài khoản, giỏ ]
[ Hàng 2: 6 link mua theo nhu cầu ]
┌ Khối (khung 1280px) ───────────────────────────────────────┐
│                         (icon SearchX)                      │
│                    Không tìm thấy trang                     │
│   Đường dẫn có thể đã sai hoặc trang đã bị gỡ. Bạn có thể   │
│          tìm sản phẩm ở ô tìm kiếm phía trên.               │
│          [ Về trang chủ ]  [ Xem tất cả sản phẩm ]          │
└─────────────────────────────────────────────────────────────┘
[ Footer ]
```

| Phần | Giá trị |
|---|---|
| Khung | `RootLayout` với header đầy đủ (khách tìm tiếp được ngay); không handle riêng. Nội dung rộng tối đa **1280px**, căn giữa trong lề `--gutter`, cách header 32px (16px của `<main>` + 16px của trang), như giỏ hàng và đơn hàng |
| Khối | `EmptyState` (design-system §9.12) bản trang: nền `--bg-surface`, viền 1px `--border-divider`, bo 16px, padding `56px 24px` (<640: `40px 16px`), nội dung căn giữa |
| Icon | `SearchX` 48 `--fg-icon-soft`, `aria-hidden`, cách tiêu đề 12px |
| Tiêu đề | `<h1>` "Không tìm thấy trang" 24/32/600 `--fg-heading` (<640: 20/28) |
| Câu giải thích | "Đường dẫn có thể đã sai hoặc trang đã bị gỡ. Bạn có thể tìm sản phẩm ở ô tìm kiếm phía trên." 16/24 `--fg-muted`, rộng tối đa 480px, cách tiêu đề 8px |
| Nút | cách câu 24px, hàng ngang căn giữa, gap 12px, xuống dòng được: `Link` kiểu `Button primary md` "Về trang chủ" → `/`; `Link` kiểu `Button secondary md` "Xem tất cả sản phẩm" → `/products` (`buttonClass`, §9.3). Đây là nút `primary` duy nhất của trang |
| Dưới khối | không có gì thêm; footer theo sau như mọi trang |

## 3. Trạng thái

Chỉ một trạng thái. Không có tải, lỗi, rỗng.

## 4. Responsive

| Màn | Khác biệt |
|---|---|
| ≥640 | Như mục 2 |
| <640 | Khối padding `40px 16px`, giữ lề 16px và bo 16px (không tràn bề ngang); tiêu đề 20/28; hai nút xếp dọc, mỗi nút rộng 100% khối, "Về trang chủ" ở trên |

## 5. Trợ năng

- Một `<h1>`; khối là `<section aria-labelledby>` trỏ vào `<h1>`.
- Không tự chuyển focus vào khối; sau khi đổi route thì focus theo cách router đang làm ở các trang khác.
- Icon `aria-hidden`; hai link đọc đúng chữ trên nút.

## 6. Ngoài phạm vi

Trả HTTP 404 thật từ CloudFront hoặc render sẵn HTML; hình minh hoạ lớn, trò chơi; ô tìm kiếm riêng trong khối (header đã có); gợi ý sản phẩm, dải "Hàng mới về"; tự chuyển về trang chủ sau vài giây; báo lỗi đường dẫn về server. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md) và mục 1.

## 7. Việc còn lại

- `EmptyState` thêm prop `title` (tiêu đề trong khối, chọn cấp `h1`/`h2`) và `className` (đổi padding cho bản trang); hàng nút trong `action` là flex gap 12px, xuống dòng được (design-system §9.12).
