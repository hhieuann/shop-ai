# ADR-0006: Một CloudFront cho web và API, WAF gói Free

- Trạng thái: Chấp nhận, cập nhật 29/10/2026 (xem cuối trang)
- Ngày: 30/09/2026
- Người quyết: An, Nhân

## Bối cảnh

Web tĩnh nằm trên S3, API nằm trên API Gateway. Cần WAF để chặn tấn công và spam, nhưng WAF trả theo dùng tốn khoảng $5 + $1 mỗi rule mỗi tháng. CloudFront có gói flat-rate Free: 1 triệu request, 100 GB mỗi tháng, WAF 5 rule, không tính phí vượt. Mỗi tài khoản được 3 gói Free.

## Quyết định

- Mỗi môi trường một distribution CloudFront gói Free: `/` → S3 qua Origin Access Control, `/api/*` → API Gateway.
- WAF 5 rule: core rule set, known bad inputs, IP reputation, giới hạn tốc độ, và một rule riêng cho `/api/events`.

## Hệ quả

- Dễ hơn: một WAF bảo vệ cả web và API; cùng tên miền nên không có CORS.
- Khó hơn: gọi thẳng URL của API Gateway sẽ đi vòng qua WAF. Nhân xử lý bằng header bí mật từ CloudFront, hoặc ghi rõ là giới hạn đã biết.
- Gói Free không hỗ trợ rule group tự tạo và một số tính năng CloudFront nâng cao; không cần cho dự án này.

## Cập nhật 29/10/2026: bỏ gói CloudFront Free, WAF chỉ ở prod

- **Lý do bỏ gói Free:** tài khoản demo đang ở Free account plan. Theo tài liệu CloudFront flat-rate pricing plans (mục "Account-level constraints"), tài khoản đang dùng AWS Free Tier không đăng ký được pricing plan. Ngoài ra CloudFormation, CDK chưa đăng ký được gói (aws-cdk issue #37857), chỉ làm bằng console hoặc API PricingPlanManager. Nhóm không nâng cấp tài khoản.
- **Quyết định:** WAF trả theo dùng, **chỉ gắn ở prod**. Dev, staging không có WAF.
- **Chi phí ước tính:** khoảng $5 mỗi web ACL + $1 mỗi rule mỗi tháng, 5 rule khoảng $10/tháng, cộng $0.60 mỗi triệu request; trừ vào credit.
- **Cách làm:** web ACL scope `CLOUDFRONT` phải nằm ở us-east-1, nên tách stack `shop-prd-waf` ở us-east-1 (`infra/lib/waf-stack.ts`); stack web ở ap-southeast-1 nhận ARN qua `crossRegionReferences`. `cdk deploy --all` tự deploy stack WAF trước. Toàn bộ bằng CDK, không có bước tay.
- **5 rule giữ như trên**, thứ tự: IP reputation, giới hạn tốc độ chung (1000 request mỗi 5 phút mỗi IP), giới hạn riêng `/api/v1/events` (300 request mỗi 5 phút mỗi IP), core rule set, known bad inputs. Log WAF vào `aws-waf-logs-shop-prd`, giữ 14 ngày, che header `authorization` và `cookie`.
- **Hệ quả:** dev, staging không được WAF bảo vệ; chấp nhận vì không có dữ liệu thật và có throttle của API Gateway. Không còn ràng buộc của gói Free (không lọc theo header, không custom response).
