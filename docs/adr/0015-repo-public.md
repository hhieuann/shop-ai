# ADR-0015: Repo public

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An, Hoàng, Nhân

## Bối cảnh

GitHub Free chỉ cho bảo vệ nhánh và environment có bước duyệt ở repo public. Repo public còn được chạy Actions không giới hạn phút, dùng CodeQL và quét secret miễn phí, và đưa lên CV được.

## Quyết định

Repo `hhieuann/shop-ai` public. Bật đủ thiết lập bảo mật trong [setup-checklist.md](../setup-checklist.md). Nếu sau này lập organization cho nhóm thì chuyển repo sang đó.

## Hệ quả

- Dễ hơn: có đủ công cụ bảo vệ nhánh, duyệt deploy, quét bảo mật mà không tốn tiền.
- Khó hơn: ai cũng đọc được code và lịch sử commit. Không bao giờ commit secret, dữ liệu thật, ảnh lộ account ID.
- Chuyển sang organization thì phải sửa `sub` trong trust policy OIDC (ADR-0008).
