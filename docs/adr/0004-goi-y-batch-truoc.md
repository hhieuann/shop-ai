# ADR-0004: Gợi ý chạy batch trước, Personalize cắm vào sau

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An, Hoàng, Nhân

## Bối cảnh

Campaign real-time của Amazon Personalize bị tính tối thiểu 1 request mỗi giây kể cả khi không ai gọi: khoảng $146/tháng với recipe cũ, $394/tháng với recipe v2. Free plan không có bản dùng thử của Personalize, và có thể không cho dùng Personalize.

## Quyết định

- Gợi ý được tính theo lô mỗi đêm và ghi vào bảng DynamoDB `recs`. API chỉ đọc bảng này.
- Nguồn đầu tiên là baseline do Nhân viết bằng Python (bán chạy theo category, luật mua kèm).
- Personalize batch inference là nguồn thứ hai, chỉ khi mentor duyệt Paid plan.
- Campaign real-time chỉ bật khi demo; Lambda hẹn giờ tự xoá campaign sống quá 3 giờ.

## Hệ quả

- Dễ hơn: web chạy được kể cả khi chưa có Personalize; so AI với baseline chỉ là so hai nguồn ghi vào cùng bảng.
- Khó hơn: gợi ý không cập nhật tức thì theo từng cú click, trừ lúc demo có campaign.
- Luận điểm business: shop nhỏ làm mới gợi ý mỗi đêm là đủ, chi phí gần 0.
