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

## Trạng thái các chương

Cập nhật 17/11/2026. **Hạn bản nháp: 24/11**, để còn thời gian ghép và soát. **Hạn nộp Workshop: khoảng 29/11.** Ai xong chương nào thì sửa cột Trạng thái trong cùng PR.

Bản đã xong xem trên site báo cáo của An: <https://hhieuann.github.io/fcaj-report/vi/5-workshop/> (tiếng Anh bỏ `vi/`).

| Trang | Người viết | Trạng thái | Bản hiện có |
|---|---|---|---|
| 5. Workshop (trang mở đầu: tên lab, giới thiệu, mục lục) | An | Chưa | |
| 5.1 Introduction | An | Chưa, chờ sơ đồ kiến trúc An tự vẽ | |
| 5.2 Prerequisite (chuẩn bị, chi phí) | An | Xong | [site](https://hhieuann.github.io/fcaj-report/vi/5-workshop/5.2-prerequisite/) |
| 5.3 Hạ tầng và CI/CD | An | Xong | [site](https://hhieuann.github.io/fcaj-report/vi/5-workshop/5.3-infrastructure/) |
| 5.4 Luồng bán hàng | Hoàng | Bản nháp, còn ảnh chụp và số chi phí | [`5.4-luong-ban-hang.md`](5.4-luong-ban-hang.md) |
| 5.5 Gợi ý và bảo mật dữ liệu | Nhân | Bản nháp, còn sửa theo góp ý #486 và thêm ảnh | [`5.5-goi-y-va-bao-mat-du-lieu.md`](5.5-goi-y-va-bao-mat-du-lieu.md) |
| 5.6 Kiểm thử và vận hành | An | Xong | [site](https://hhieuann.github.io/fcaj-report/vi/5-workshop/5.6-testing/) |
| 5.7 Clean up | An | Xong | [site](https://hhieuann.github.io/fcaj-report/vi/5-workshop/5.7-cleanup/) |
| Video demo trên prod | An | Chưa, sau `v1.0.0` | |

## Dàn ý các chương còn thiếu

**5.1 Introduction (An):** bài toán (shop laptop và linh kiện, có gợi ý sản phẩm, chi phí gần 0 khi ít khách, không quản lý server); người đọc làm được gì sau lab; sơ đồ kiến trúc tự vẽ, đánh số 3 luồng (xem hàng, đặt hàng, gợi ý mỗi đêm); bảng dịch vụ: dùng làm gì, vì sao chọn (lấy từ `docs/adr/`).

**5.4 Luồng bán hàng (Hoàng):** thêm vào giỏ → đặt hàng (`Idempotency-Key`, 409 khi giá đổi) → SQS → worker xác nhận → email SES (sandbox chỉ gửi tới địa chỉ đã xác minh) → huỷ đơn hoàn kho → admin chuyển trạng thái. Ảnh: màn hình web, bảng đơn trên DynamoDB console, tin trong hàng đợi SQS.

## Cách viết và nộp bản nháp

- Viết theo khuôn của các chương đã xong: **Mục tiêu** → **lệnh hoặc thao tác trên console** → **ảnh chụp kết quả** → **kiểm tra đúng chưa**. Cuối chương có phần chi phí riêng (nếu có) và Clean up riêng (nếu có).
- Lệnh dùng sandbox của người đọc: `-c env=sbx -c owner=<tên>`, như chương 5.3. Chụp ảnh bằng sandbox của chính mình (`shop-sbx-<tên>`).
- Viết hai file trong thư mục này: `5.x-<tên>.md` (tiếng Việt) và `5.x-<tên>.en.md` (tiếng Anh), mở PR vào `develop`. An chép sang site báo cáo theo khung Hugo (front matter, đánh số 5.x.1, `{{% notice %}}`).
- Ảnh để tạm trong PR hoặc gửi An; nhớ làm mờ account ID và email.

## Lưu ý khi viết

- Mỗi bước có ảnh chụp; làm mờ account ID và email
- Có phần chi phí; thiếu phần này thì mất điểm trình bày
- Có demo chạy thật; không demo được thì mất điểm demo
- Sơ đồ kiến trúc AWS nhóm tự vẽ (draw.io + icon AWS); sơ đồ do AI vẽ bị 0 điểm
- Báo cáo song ngữ Việt và Anh theo template của chương trình, đăng lên GitHub Pages; nộp link website, không nộp link source
