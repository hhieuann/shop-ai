# Runbook: WAF của CloudFront prod

Stack: `shop-prd-waf` (us-east-1, chỉ prod) · Web ACL: `shop-prd-web` · Log: `aws-waf-logs-shop-prd` (us-east-1, giữ 14 ngày) · Người trực: Nhân

Không có alarm riêng cho WAF (đã hết 10 alarm miễn phí). Runbook này dùng khi khách báo bị chặn, sau mỗi lần deploy prod có đổi WAF, và khi dọn tài khoản sau khi nộp bài. Cấu hình ở `infra/lib/waf-stack.ts`, lý do ở ADR-0006 (cập nhật 29/10/2026).

| Thứ tự | Rule | Hành động |
|---|---|---|
| 10 | `AWSManagedRulesAmazonIpReputationList` | Chặn |
| 20 | `RateLimitPerIp`: quá 1000 request `/api/` trong 5 phút mỗi IP | Chặn |
| 30 | `RateLimitEventsPerIp`: quá 300 request `/api/v1/events` trong 5 phút mỗi IP | Chặn |
| 40 | `AWSManagedRulesCommonRuleSet` | Chặn từ `v1.0.0`. Chỉ đếm ở `v1.0.0-rc.1`; log prod 12/11–16/11 không có đếm nhầm (#457). Từ `v1.0.0`, request thử ở bước 1 dưới đây bị chặn (403) và có dòng `BLOCK` với `terminatingRuleId` là `AWSManagedRulesCommonRuleSet` thay cho dòng `COUNT` |
| 50 | `AWSManagedRulesKnownBadInputsRuleSet` | Chặn |

## Kiểm tra sau mỗi lần deploy prod có đổi WAF

Đã kiểm 13/11/2026 (`v1.0.0-rc.1`, core rule set đang đếm): request thử bị đếm đúng rule con, luồng giỏ hàng, đặt và huỷ đơn không bị đếm, 0 BLOCK trong 87 request.

**Từ `v1.0.0` core rule set chặn** (#458), nên kết quả mong đợi ở bước 1 và bước 4 khác lúc còn đếm; cả hai trường hợp ghi bên dưới.

Smoke test chỉ gọi GET, còn WAF chỉ có ở prod, nên luồng ghi chưa từng đi qua WAF trước lần này.

**Lưu ý về log:** rule bị khớp nằm ở hai chỗ khác nhau trong log WAF. Rule chặn trực tiếp có tên ở `terminatingRuleId`. Rule con của nhóm managed ở chế độ đếm (core rule set) **không** nằm ở `nonTerminatingMatchingRules` cấp ngoài mà nằm trong `ruleGroupList[].nonTerminatingMatchingRules`, và vị trí trong mảng tuỳ thứ tự nhóm. Vì vậy câu truy vấn dưới đây lọc theo nội dung `@message` và luôn hiện cả `@message`; phải thử bằng request cố ý trước (bước 1) rồi mới tin một kết quả rỗng.

1. **Thử câu truy vấn trước.** Mở **một cửa sổ ẩn danh riêng**, vào `https://<domain prod>/?x=<script>alert(1)</script>`, thấy kết quả thì **đóng cửa sổ đó ngay**. Đây là request vô hại để core rule set khớp một lần (`CrossSiteScripting_QUERYARGUMENTS`). Từ `v1.0.0` (đang chặn): trình duyệt nhận **403** từ CloudFront, đúng như mong đợi. Lúc còn đếm (`v1.0.0-rc.1`): trang chủ hiện bình thường. Không bấm tiếp trong cửa sổ này: mọi request sau đó mang header `Referer` chứa payload và cũng bị đếm (`CrossSiteScripting_COOKIE`, lần kiểm 13/11 có 49 request như vậy), làm rối kết quả (khi đang chặn thì các request đó cũng bị 403).
2. Mở **cửa sổ ẩn danh mới**, vào web prod: đăng ký hoặc đăng nhập, thêm giỏ, đặt 1 đơn rồi huỷ đơn đó. Ghi lại giờ.
3. CloudWatch Logs Insights, **vùng us-east-1**, log group `aws-waf-logs-shop-prd`, khung 1 giờ:

   ```text
   fields @timestamp, action, terminatingRuleId, httpRequest.httpMethod, httpRequest.uri, @message
   | filter action = "BLOCK" or @message like /"action":"COUNT"/
   | parse @message /"terminatingRule":\{"ruleId":"(?<subRule>[^"]+)"/
   | display @timestamp, action, terminatingRuleId, subRule, httpRequest.httpMethod, httpRequest.uri
   | sort @timestamp desc
   | limit 50
   ```

4. **Kiểm câu truy vấn:** phải thấy dòng của request ở bước 1 với `subRule` là `CrossSiteScripting_QUERYARGUMENTS`. Từ `v1.0.0` (đang chặn): dòng đó có `action` là `BLOCK`, `terminatingRuleId` là `AWSManagedRulesCommonRuleSet`. Lúc còn đếm, cột `action` vẫn là `ALLOW` và `terminatingRuleId` là `Default_Action`, nên tên rule con chỉ thấy ở `subRule` (lấy từ `ruleGroupList` trong `@message`). Không thấy dòng đó thì câu truy vấn sai: mở một dòng log bất kỳ, xem tên trường thật rồi sửa câu truy vấn (và sửa runbook này) trước khi đọc tiếp.
5. **Đọc kết quả:** không có dòng `BLOCK` nào cho request ở bước 2. Từ `v1.0.0`, dòng `BLOCK` nào thuộc request ở bước 2 là **chặn nhầm**: ghi lại `subRule`, đường dẫn, rồi làm theo bước 3 của mục "Chuyển core rule set từ đếm sang chặn" bên dưới. Lúc còn đếm, dòng `COUNT` thuộc bước 2 là chỗ sẽ chặn nhầm khi chuyển sang chặn.
6. Ghi kết quả vào checklist của bản vừa deploy, kèm câu truy vấn đã chỉnh nếu có.

## Chuyển core rule set từ đếm sang chặn

**Đã làm 16/11/2026** (#458, lên prod cùng `v1.0.0`): log prod 12/11–16/11 có 678 request, core rule set đếm 74 request và đều là request thử XSS (payload ở query hoặc `Referer`), không có đếm nhầm. Giữ mục này để dùng lại nếu phải đưa một rule con về đếm.

Làm sau khoảng 3 ngày chạy prod, hoặc sau buổi tập demo, khi log không có request thật nào bị core rule set đếm nhầm.

1. Chạy lại câu Logs Insights ở trên với khung 3 ngày, bỏ các request thử cố ý: có payload trong query hoặc trong `Referer` (thêm `| filter @message not like /%3Cscript%3E|<script>/`).
2. Không có đếm nhầm: mở PR đổi `COMMON_RULE_SET_COUNT_ONLY` thành `false` trong `infra/lib/waf-stack.ts`, sửa test tương ứng, deploy prod theo quy trình phát hành.
3. **Chặn nhầm hoặc đếm nhầm:** có rule con khớp request thật (vd. `SizeRestrictions_BODY`, `CrossSiteScripting_BODY` với địa chỉ có ký tự lạ): giữ đếm, mở issue ghi tên rule con và request mẫu, rồi thêm `ruleActionOverrides` để chỉ rule con đó ở chế độ đếm.

## Khách báo bị chặn (trang trắng hoặc lỗi 403 từ CloudFront)

1. Hỏi giờ, đường dẫn và IP công khai của khách (nếu biết).
2. Chạy câu Logs Insights ở trên, lọc thêm `| filter httpRequest.clientIp = "<IP>"`.
3. `terminatingRuleId` cho biết rule nào chặn:

| Rule chặn | Xử lý |
|---|---|
| `RateLimitPerIp` | Nhiều người chung một IP (Wi-Fi trường, lúc demo) hoặc bị spam. IP tự hết bị chặn sau khi tốc độ giảm. Demo đông người: nâng `RATE_LIMIT_ALL` bằng PR trước buổi demo |
| `RateLimitEventsPerIp` | Spam sự kiện (threat model E2, E7) hoặc lỗi web gửi lặp. Kiểm tra web trước khi nâng ngưỡng |
| `AWSManagedRulesAmazonIpReputationList` | IP nằm trong danh sách xấu của AWS (VPN, proxy). Khuyên khách đổi mạng; không tắt rule |
| `AWSManagedRulesKnownBadInputsRuleSet` | Request chứa mẫu tấn công đã biết. Xem `httpRequest.uri`, thường là bị dò thật |

## Dọn sau khi nộp bài

WAF tốn khoảng $10/tháng. OJT kéo dài tới 14/12 và người chấm có thể còn cần vào web, nên chọn một trong hai cách. Stack WAF bật termination protection và log group để RETAIN, nên làm từng bước.

### Cách A (khuyên dùng): chỉ gỡ WAF, giữ web prod

Web ACL đang gắn vào distribution nên phải gỡ khỏi web trước, rồi mới xoá được stack WAF.

1. Mở PR bỏ WAF ở prod: trong `infra/bin/shop.ts`, không tạo `WafStack` nữa (`const waf = undefined`) để stack web không còn `webAclArn`; sửa test tương ứng; cập nhật ADR-0006 và threat model C2 (prod không còn WAF).
2. Deploy prod theo quy trình phát hành (tag). Stack `shop-prd-web` cập nhật, distribution không còn web ACL. `cdk deploy --all` không còn đụng tới `shop-prd-waf` vì stack đó không còn trong app.
3. Xoá stack WAF và log group:

   ```bash
   aws cloudformation update-termination-protection --no-enable-termination-protection \
     --stack-name shop-prd-waf --region us-east-1
   aws cloudformation delete-stack --stack-name shop-prd-waf --region us-east-1
   aws cloudformation wait stack-delete-complete --stack-name shop-prd-waf --region us-east-1
   aws logs delete-log-group --log-group-name aws-waf-logs-shop-prd --region us-east-1
   aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1
   ```

4. Mở web prod kiểm trang vẫn chạy; hôm sau mở Billing kiểm mục WAF không còn phát sinh phí.

### Cách B: dọn cả prod (web prod sẽ mất)

Chỉ dùng khi chắc không ai cần vào web nữa. Sau cách này **web prod không còn truy cập được**.

```bash
# 0. Ghi lại tên bucket web prod (output WebBucketName) trước khi xoá stack
aws cloudformation describe-stacks --stack-name shop-prd-web --region ap-southeast-1 \
  --query "Stacks[0].Outputs[?ends_with(OutputKey, 'WebBucketName')].OutputValue" --output text

# 1. Xoá stack web prod trước (gỡ web ACL khỏi CloudFront); stack này cũng bật termination protection
aws cloudformation update-termination-protection --no-enable-termination-protection \
  --stack-name shop-prd-web --region ap-southeast-1
aws cloudformation delete-stack --stack-name shop-prd-web --region ap-southeast-1
aws cloudformation wait stack-delete-complete --stack-name shop-prd-web --region ap-southeast-1

# 2. Bucket web prod để RETAIN nên còn lại sau khi xoá stack: xoá tay bằng tên ghi ở bước 0
aws s3 rb s3://<tên bucket web prod> --force

# 3. Xoá stack WAF ở us-east-1 và log group được giữ lại
aws cloudformation update-termination-protection --no-enable-termination-protection \
  --stack-name shop-prd-waf --region us-east-1
aws cloudformation delete-stack --stack-name shop-prd-waf --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name shop-prd-waf --region us-east-1
aws logs delete-log-group --log-group-name aws-waf-logs-shop-prd --region us-east-1

# 4. Kiểm tra không còn web ACL nào
aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1
```

Hôm sau mở Billing kiểm mục WAF và CloudFront không còn phát sinh phí.
