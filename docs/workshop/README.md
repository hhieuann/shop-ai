# Workshop FCAJ

Trang workshop trong báo cáo FCAJ là **bài hướng dẫn để người khác làm lại từng bước**, không phải bài mô tả sản phẩm. Cấu trúc bắt buộc: Introduction → Prerequisite → các bước thực hành → **Clean up**.

Nếu mentor chấm theo từng người, mỗi người viết workshop từ phần mình làm:

| Người | Chủ đề workshop gợi ý | Blog lấy từ phần mình làm |
|---|---|---|
| An | Đưa web serverless lên AWS an toàn bằng CDK: CloudFront, WAF, Cognito và CI/CD không access key | CI/CD không access key với GitHub OIDC |
| Hoàng | Đơn hàng không mất khi quá tải: API Gateway → Lambda → SQS → SES | Xử lý đơn bất đồng bộ bằng SQS |
| Nhân | Gợi ý mua kèm an toàn: pipeline dữ liệu ẩn danh và chống đầu độc dữ liệu | Đầu độc dữ liệu gợi ý và cách chặn |

## Lưu ý khi viết

- Mỗi bước có ảnh chụp; làm mờ account ID và email
- Có phần chi phí; thiếu phần này thì mất điểm trình bày
- Có demo chạy thật; không demo được thì mất điểm demo
- Sơ đồ kiến trúc AWS nhóm tự vẽ (draw.io + icon AWS); sơ đồ do AI vẽ bị 0 điểm
- Báo cáo song ngữ Việt và Anh theo template của chương trình, đăng lên GitHub Pages; nộp link website, không nộp link source
