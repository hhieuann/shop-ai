# ADR-0014: Deploy Lambda ordering kiểu canary

- Trạng thái: Đề xuất
- Ngày: 30/09/2026
- Người quyết: An

## Bối cảnh

Đặt hàng là luồng quan trọng nhất. Bản lỗi lên prod là mất đơn ngay. CodeDeploy cho Lambda không tính thêm phí.

## Quyết định

Lambda của module `ordering` deploy qua alias bằng CodeDeploy: 10% lưu lượng trong 5 phút, alarm lỗi quá 1% thì tự quay về bản cũ. Các module khác deploy thẳng.

## Hệ quả

- Dễ hơn: lỗi ở luồng đặt hàng chỉ ảnh hưởng 10% và tự rollback. Điểm cộng khi trình bày.
- Khó hơn: thêm cấu hình CDK (alias, deployment group, alarm).
- Làm ở tuần 6 (Hardening), không làm sớm hơn.
