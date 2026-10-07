# Ngoài phạm vi giao diện

Người viết: Hoàng · Ngày: 06/10/2026

Các tính năng cửa hàng điện tử lớn thường có, nhưng **không có** trong tài liệu dự án (`project-plan.md`, `docs/business/`). **Không thiết kế, không code** các mục dưới đây, trừ khi tài liệu nghiệp vụ được bổ sung trước.

| Tính năng | Vì sao không làm |
|---|---|
| Giảm giá: nhãn khuyến mãi, "-17%", "Tiết kiệm …", giá cũ gạch ngang, flash sale, đồng hồ đếm ngược | catalog BR-05: giá là số nguyên, không có giảm giá |
| Chọn biến thể (màu, cấu hình) | catalog BR-07: không có biến thể |
| Nhãn "tương thích" giữa linh kiện | catalog BR-06 |
| Cột bộ lọc nhiều nhóm (thương hiệu, RAM, CPU, khoảng giá, đánh giá…), chip lọc nhanh | Chỉ lọc theo `category` (BR-02) |
| Sao đánh giá, số lượt đánh giá, tóm tắt đánh giá, hỏi đáp, ảnh của khách | Không có dữ liệu đánh giá |
| Sắp xếp "Liên quan nhất", "Đánh giá cao" | BR-08 chỉ có mới nhất, giá tăng, giá giảm |
| "18 / 7.053 sản phẩm" | API phân trang bằng cursor, không trả tổng |
| Nút "Thêm vào giỏ" và ô "So sánh" ngay trên thẻ sản phẩm, thanh so sánh | Thêm giỏ ở trang chi tiết; không có so sánh |
| Lưu sản phẩm, danh sách yêu thích, "Lưu để mua sau" trong giỏ | Không có trong nghiệp vụ (`cart.md`) |
| Nhận tại cửa hàng, chọn cửa hàng, chọn ngày nhận, chọn cách nhận cho từng món | Không có cửa hàng; chỉ giao hàng COD, miễn phí (ordering BR-05, BR-06) |
| Nhãn "Sắp về", "Đặt trước", "Mới", nút "Báo khi có hàng" | Không có trạng thái này trong mô hình sản phẩm |
| Thanh khuyến mãi đầu trang, banner quảng cáo, sản phẩm tài trợ | Không có quảng cáo |
| Trợ lý chat nổi góc màn hình | Không có trong phạm vi |
| Mã model, SKU; nhiều ảnh, video, phóng to ảnh; nhãn "Bán chạy" | API chỉ có một `imageUrl` |
| Trả góp, tài chính | Chỉ COD (ordering BR-05) |
| Thu cũ đổi mới, gói bảo hành, phụ kiện kèm khi mua | Không có trong nghiệp vụ. Gợi ý món đi kèm do widget gợi ý của An đảm nhận |
| Thẻ tín dụng, ví điện tử, thẻ quà tặng, điểm thưởng, hội viên, địa chỉ thanh toán | Chỉ COD |
| Thuế, gói quà | Tổng = giá × số lượng, không phát sinh (ordering BR-06) |
| Email liên hệ và đăng ký nhận SMS ở bước đặt hàng | Đã có email tài khoản; số điện thoại chỉ để giao hàng |
| Đăng nhập bằng số điện thoại, passkey, Google, Apple; tài khoản doanh nghiệp; số điện thoại khôi phục | Cognito email + mật khẩu (ADR-0007) |
| Trang tài khoản tổng quan, sổ địa chỉ, theo dõi vận chuyển, đổi trả | Không có trong nghiệp vụ |
| Trong menu tài khoản: hồ sơ (Account), phương thức thanh toán, thẻ tín dụng, gói dịch vụ, sản phẩm đã lưu, cài đặt tài khoản, hỗ trợ, ảnh đại diện | Không có trang nào trong số này; chỉ COD; không có yêu thích (design-system §9.17) |
| Quyền lợi tài khoản "miễn phí vận chuyển", "thanh toán nhanh", "*Áp dụng có điều kiện" | Mọi đơn đều miễn phí vận chuyển (ordering BR-06); không lưu địa chỉ hay thẻ; không có điều kiện ưu đãi |

Muốn làm một mục ở trên: viết hoặc sửa tài liệu nghiệp vụ trước (`docs/business/_template.md`), rồi mới thêm spec giao diện.
