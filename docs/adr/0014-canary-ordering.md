# ADR-0014: Deploy Lambda ordering kiểu canary

- Trạng thái: Hoãn (An chốt 06/11/2026, xem cuối trang)
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

## Cập nhật 06/11/2026: hoãn, chưa làm ở `v1.0.0-rc.1`

- **Lý do:** thêm alias, deployment group, alarm và runbook sát ngày tách nhánh, phải thử trên staging, trong khi nhóm còn admin, load test và diễn tập phục hồi. Rủi ro thêm vào lớn hơn lợi ích với quy mô demo.
- **Thực tế hiện tại:** mọi Lambda deploy thẳng bằng `cdk deploy`, không có alias hay CodeDeploy, không chia lưu lượng. `v0.1.0` và `v0.2.0` đều deploy kiểu này.
- **Cách quay lui:** CloudFormation tự quay về khi deploy lỗi. Bản đã lên mà có lỗi thì sửa rồi gắn tag mới theo quy trình phát hành.
- **Hệ quả:** bản lỗi qua được smoke test sẽ ảnh hưởng toàn bộ khách đặt hàng cho tới khi có bản sửa; chấp nhận vì chưa có khách thật. Khi trình bày không được nói dự án có canary.
