# Nghiệp vụ

Mỗi tính năng một file trong thư mục này, viết theo [\_template.md](_template.md). Hạn chốt nghiệp vụ cho Sprint 1: **hết Chủ nhật 05/10/2026**.

Luồng đi của một yêu cầu: **nghiệp vụ → user story và tiêu chí nghiệm thu (GitHub issue) → `contracts/openapi.yaml` → code và test**.

## Những gì nhóm cần chốt

| Module | Cần chốt | Ảnh hưởng tới |
|---|---|---|
| Catalog | Thuộc tính theo từng loại linh kiện (socket CPU, công suất PSU…); có biến thể không; hiển thị tồn kho ra sao; có giảm giá không; lọc và tìm theo gì | Bảng `products`, index, API lọc, cache |
| Tài khoản | Khách chưa đăng nhập xem và thêm giỏ được không; các vai trò (customer, staff, admin); hồ sơ và địa chỉ gồm gì | Cognito groups, phân quyền API · Đã chốt: [account.md](account.md) |
| Giỏ hàng | Có bắt buộc đăng nhập; giới hạn số lượng; khi giá đổi thì xử lý sao; giỏ có hết hạn không | Bảng `carts`, luật trong domain |
| Đơn hàng | Các trạng thái và ai được chuyển trạng thái; huỷ được tới lúc nào; trừ tồn kho lúc đặt hay lúc xác nhận; COD hay thanh toán giả lập; định dạng mã đơn | Máy trạng thái, SQS, idempotency |
| Gợi ý | Hiện ở đâu (trang chủ, chi tiết, giỏ); loại trừ hàng hết và hàng đã trong giỏ; bao nhiêu món; người mới chưa có dữ liệu thì hiện gì | API gợi ý, luật lọc |
| Thông báo | Sự kiện nào gửi email cho khách, sự kiện nào báo admin | Mẫu SES, topic SNS |
| Admin | Cần xem gì: doanh thu, đơn theo trạng thái, sản phẩm bán chạy | Index phụ, báo cáo |
| Quy mô demo | Số sản phẩm, số người dùng, số đơn mỗi ngày giả định | Mục tiêu phi chức năng, load test · Đã chốt: [demo-scale.md](demo-scale.md) |
