# Quy mô demo

- Phạm vi: toàn hệ thống (số liệu đầu vào cho mục tiêu phi chức năng, load test, phần chi phí của báo cáo)
- Người viết: An · Ngày: 08/10/2026

Dự án là **shop nhỏ** bán linh kiện máy tính. Không có người dùng thật; dữ liệu là giả lập có logic (project-plan.md mục 5). Các con số dưới đây là **giả định để thiết kế và đo đạc**, không phải dự báo kinh doanh. Báo cáo phải ghi rõ điều này.

## Số liệu giả định

| Đại lượng | Ngày thường | Cao điểm (khuyến mãi, ra mắt GPU mới) | Nguồn hoặc lý do |
|---|---|---|---|
| Sản phẩm đang bán | 104 (13 loại × 8) | như ngày thường | `services/api/seed/catalog/products.json` (#44) |
| Khách hàng có tài khoản | 400 (giả lập theo 4 persona) | — | project-plan.md: 300–500 khách giả lập |
| Lượt xem trang mỗi ngày | 2.000 | 20.000 | shop nhỏ; cao điểm gấp 10 lần |
| Đơn mỗi ngày | 30 | 300 | khoảng 1,5% lượt xem thành đơn |
| Người dùng cùng lúc | 20 | 200 | cao điểm dồn vào 1–2 giờ |
| Sự kiện hành vi (xem, thêm giỏ, mua) mỗi ngày | khoảng 10.000 | khoảng 100.000 | đầu vào cho pipeline gợi ý của Nhân |

## Mức tải dùng để đo (tuần 6)

| Kịch bản k6 | Người ảo | Ý nghĩa |
|---|---|---|
| Thường | 50 | Gấp đôi ngày thường, kiểm hệ thống chạy thoải mái |
| Cao điểm | 200 | Đúng cao điểm giả định; mục tiêu p95 API đọc ≤ 300 ms (engineering-plan.md mục 3) |
| Gấp 5 lần cao điểm | 1.000 | Xem hệ thống serverless tự giãn ra sao so với bản đối chứng EC2; chỉ chạy ngắn vì tốn request |

## Ngân sách và chỉ số chi phí

- Toàn dự án dưới **$15** (an.md, engineering-plan.md mục 3); budget cảnh báo $5, $10, $17, $20 mỗi tháng.
- Chi phí đo bằng Cost Explorer lọc theo tag `project = shop-ai`, tách theo `env` và `module` (bật ngày 08/10/2026).
- Chỉ số báo cáo: **chi phí trên 1.000 đơn** ở mức ngày thường và cao điểm, so với bản đối chứng EC2.

## Giới hạn đã biết ở quy mô này

- Email xác nhận dùng gửi mặc định của Cognito, giới hạn khoảng **50 email mỗi ngày**: đủ cho demo và test; vượt thì chuyển sang SES (account.md).
- Tìm kiếm sản phẩm chạy trong bộ nhớ Lambda (catalog.md "Cách hiện thực tìm kiếm"), hợp với catalog dưới vài nghìn sản phẩm.
- Load test 1.000 người ảo tốn request API Gateway và Lambda; chạy ngắn và chỉ trên staging.

## Tiêu chí nghiệm thu

- Given 200 người ảo gọi danh sách và chi tiết sản phẩm trong 5 phút, When đo bằng k6, Then p95 ≤ 300 ms và lỗi 5xx dưới 1%.
- Given cả tháng demo, When xem Cost Explorer lọc `project = shop-ai`, Then tổng chi phí dưới $15.
