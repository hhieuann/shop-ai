# Runbook: WAF của CloudFront prod

Stack: `shop-prd-waf` (us-east-1, chỉ prod) · Web ACL: `shop-prd-web` · Log: `aws-waf-logs-shop-prd` (us-east-1, giữ 14 ngày) · Người trực: Nhân

Không có alarm riêng cho WAF (đã hết 10 alarm miễn phí). Runbook này dùng khi khách báo bị chặn, sau mỗi lần deploy prod có đổi WAF, và khi dọn tài khoản sau khi nộp bài. Cấu hình ở `infra/lib/waf-stack.ts`, lý do ở ADR-0006 (cập nhật 29/10/2026).

| Thứ tự | Rule | Hành động |
|---|---|---|
| 10 | `AWSManagedRulesAmazonIpReputationList` | Chặn |
| 20 | `RateLimitPerIp`: quá 1000 request `/api/` trong 5 phút mỗi IP | Chặn |
| 30 | `RateLimitEventsPerIp`: quá 300 request `/api/v1/events` trong 5 phút mỗi IP | Chặn |
| 40 | `AWSManagedRulesCommonRuleSet` | **Chỉ đếm** tới khi xem log sau deploy đầu |
| 50 | `AWSManagedRulesKnownBadInputsRuleSet` | Chặn |

## Kiểm tra sau lần deploy prod đầu (v1.0.0-rc.1)

Smoke test chỉ gọi GET, còn WAF chỉ có ở prod, nên luồng ghi chưa từng đi qua WAF trước lần này.

1. Mở web prod bằng trình duyệt ẩn danh: đăng ký hoặc đăng nhập, thêm giỏ, đặt 1 đơn rồi huỷ đơn đó.
2. CloudWatch Logs Insights, **vùng us-east-1**, log group `aws-waf-logs-shop-prd`, khung 1 giờ, tìm request bị chặn hoặc bị core rule set đếm:

   ```text
   fields @timestamp, action, terminatingRuleId, httpRequest.uri, httpRequest.httpMethod
   | filter action = "BLOCK" or ispresent(nonTerminatingMatchingRules.0.ruleId)
   | sort @timestamp desc
   | limit 50
   ```

3. Kết quả đúng: không có dòng `BLOCK` nào cho request của mình; dòng có `nonTerminatingMatchingRules` (core rule set đếm) thì ghi lại tên rule con và đường dẫn.
4. Ghi kết quả vào checklist rc.1.

## Chuyển core rule set từ đếm sang chặn

Làm sau khoảng 3 ngày chạy prod, hoặc sau buổi tập demo, khi log không có request thật nào bị core rule set đếm nhầm.

1. Chạy lại câu Logs Insights ở trên với khung 3 ngày.
2. Không có đếm nhầm: mở PR đổi `COMMON_RULE_SET_COUNT_ONLY` thành `false` trong `infra/lib/waf-stack.ts`, sửa test tương ứng, deploy prod theo quy trình phát hành.
3. Có rule con đếm nhầm (vd. `SizeRestrictions_BODY`, `CrossSiteScripting_BODY` với địa chỉ có ký tự lạ): giữ đếm, mở issue ghi tên rule con và request mẫu, rồi thêm `ruleActionOverrides` để chỉ rule con đó ở chế độ đếm.

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

WAF tốn khoảng $10/tháng, nên xoá ngay sau khi nộp bài. Stack bật termination protection và log group để RETAIN, nên phải làm từng bước. Web ACL đang gắn vào distribution nên không xoá được trước stack web: xoá stack web prod trước (thường làm cùng lúc dọn cả prod).

```bash
# 1. Xoá stack web prod trước (gỡ web ACL khỏi CloudFront); termination protection cũng đang bật
aws cloudformation update-termination-protection --no-enable-termination-protection \
  --stack-name shop-prd-web --region ap-southeast-1
aws cloudformation delete-stack --stack-name shop-prd-web --region ap-southeast-1
aws cloudformation wait stack-delete-complete --stack-name shop-prd-web --region ap-southeast-1

# 2. Xoá stack WAF ở us-east-1
aws cloudformation update-termination-protection --no-enable-termination-protection \
  --stack-name shop-prd-waf --region us-east-1
aws cloudformation delete-stack --stack-name shop-prd-waf --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name shop-prd-waf --region us-east-1

# 3. Log group được giữ lại khi xoá stack: xoá tay
aws logs delete-log-group --log-group-name aws-waf-logs-shop-prd --region us-east-1

# 4. Kiểm tra không còn web ACL nào
aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1
```

Hôm sau mở Billing kiểm tra mục WAF không còn phát sinh phí.
