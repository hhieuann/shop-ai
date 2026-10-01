# Workshop FCAJ

Trang workshop trong báo cáo FCAJ là **bài hướng dẫn để người khác làm lại từng bước**, không phải bài mô tả sản phẩm. Cấu trúc bắt buộc: Introduction → Prerequisite → các bước thực hành → **Clean up**.

Workshop **chấm theo nhóm** (mentor xác nhận ngày 01/10/2026): cả nhóm làm **một** workshop về shop-ai, mỗi người viết các chương về phần mình làm. Workshop và Proposal chiếm 5/10 điểm của chương trình. Điểm từng người tuỳ phần đóng góp, nên ai làm việc gì thì tự mở issue, PR bằng tài khoản GitHub của mình và ghi vào worklog.

| Chương | Người viết | Nội dung |
|---|---|---|
| Introduction, Prerequisite | An | Bài toán, sơ đồ kiến trúc nhóm tự vẽ, chi phí, chuẩn bị tài khoản và công cụ |
| Hạ tầng và CI/CD | An | CDK, CloudFront + WAF, Cognito, GitHub Actions bằng OIDC không access key |
| Luồng bán hàng | Hoàng | Catalog, giỏ hàng, đặt hàng qua SQS, email qua SES; không mất đơn, không trùng đơn |
| Gợi ý và bảo mật dữ liệu | Nhân | Mô hình gợi ý tự xây trên Lambda + DynamoDB, pipeline mỗi đêm, ẩn danh dữ liệu, chống đầu độc gợi ý |
| Clean up | An | Xoá từng stack, kiểm tra Billing hôm sau |

Blog vẫn là của từng người, mỗi người 3 bài lấy từ phần mình làm.

## Lưu ý khi viết

- Mỗi bước có ảnh chụp; làm mờ account ID và email
- Có phần chi phí; thiếu phần này thì mất điểm trình bày
- Có demo chạy thật; không demo được thì mất điểm demo
- Sơ đồ kiến trúc AWS nhóm tự vẽ (draw.io + icon AWS); sơ đồ do AI vẽ bị 0 điểm
- Báo cáo song ngữ Việt và Anh theo template của chương trình, đăng lên GitHub Pages; nộp link website, không nộp link source
