# ADR-0010: Git flow

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An, Hoàng, Nhân

## Bối cảnh

- Nhóm 3 người, cần một môi trường ổn định để cả nhóm test trước khi phát hành, và một môi trường prod không bị ảnh hưởng khi `develop` đang thay đổi.
- Nhóm đã có quy trình Git chuẩn từ tài liệu đào tạo, dùng nhánh release cho mỗi lần phát hành.

## Quyết định

Làm theo [git-flow.md](../git-flow.md):

- Năm loại nhánh: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`; thêm `review/*` cho review ghi thẳng vào code
- Mỗi lần phát hành đều đi qua `release/vX.Y.Z` tách từ `develop`, test trên staging, rồi merge vào `main` và ngược về `develop`
- Merge vào nhánh chung bằng **merge commit** qua PR, có 1 người duyệt
- Tag phát hành gắn tay bằng `git tag -a vX.Y.Z` trên `main`; chỉ An được tạo tag `v*`
- Commit theo `<type>(<scope>): <mô tả>`, có thêm `merge`, `release`, `review`, `fixreview`
- Môi trường: `develop` → dev, `release/*` → staging, tag `v*` → prod (có duyệt)

## Các lựa chọn đã cân nhắc

| Kiểu | Ưu | Nhược |
|---|---|---|
| **Git flow với nhánh release mỗi lần** | Có chỗ test ổn định trước khi phát hành; khớp quy trình nhóm đã học | Thêm bước tách và merge nhánh release |
| Chỉ tách release lúc đóng băng cuối kỳ | Ít bước hơn | Các bản giữa kỳ không có chỗ test riêng |
| GitHub Flow hoặc trunk-based | Ít nhánh nhất | Cần feature flag và test rất chắc; khó với người mới |

Tự động hoá phát hành bằng release-please đã bị loại: tag do bot tạo không kích hoạt được workflow deploy, và thêm một PR mỗi lần phát hành.

## Hệ quả

- Dễ hơn: lịch sử thấy rõ nhánh nào gộp vào đâu; staging luôn là bản sắp phát hành.
- Khó hơn: phải nhớ merge ngược `release/*` và `hotfix/*` về `develop`.
- Cần xem lại khi: nhóm muốn phát hành nhiều lần mỗi tuần.
