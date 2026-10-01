# Nhân · Dữ liệu, gợi ý, bảo mật dữ liệu và AI

GitHub: [@Netanii](https://github.com/Netanii)

Bạn làm **phần AI của cửa hàng và giữ cho nó an toàn**: dữ liệu, gợi ý mua kèm, và lớp bảo vệ để AI dùng được dữ liệu mà không lộ dữ liệu mật. Đây là phần làm dự án khác các nhóm khác. Cuối dự án, phần của bạn đo bằng: gợi ý chạy mỗi đêm và có số liệu so với baseline, không dữ liệu cá nhân nào rời hệ thống chưa ẩn danh, và một thí nghiệm bảo mật có số liệu trước và sau.

## Bạn chịu trách nhiệm gì

| Khu vực | Việc cụ thể |
|---|---|
| Dữ liệu (`data/`) | Script sinh dữ liệu theo 4 persona; chia train và test theo thời gian |
| Gợi ý baseline | Bán chạy theo category; luật mua kèm (support, confidence, lift); chỉ số precision@10 và coverage |
| Pipeline mỗi đêm | Gom sự kiện → kiểm dữ liệu → tính gợi ý → ghi bảng `recs` theo phiên bản → đổi con trỏ ACTIVE. Chạy lại không nhân đôi dữ liệu; phiên bản kém hơn baseline thì không bật |
| Personalize | Chỉ khi mentor duyệt Paid plan: import, train User-Personalization-v2 và Popularity-Count làm baseline, batch inference vào bảng `recs`. Campaign chỉ bật lúc demo |
| Sự kiện (`modules/events`) | API ghi VIEW và ADD_TO_CART; PURCHASE chỉ do module `ordering` tạo; ẩn danh `userId` bằng HMAC trước khi lưu |
| Bảo mật | Threat model STRIDE; phân loại dữ liệu; review IAM và trust policy OIDC; KMS cho bucket dữ liệu; 5 rule WAF (An gắn vào CloudFront); test IDOR; OWASP ZAP; Schemathesis; xử lý cảnh báo của Dependabot, CodeQL, secret scanning; `SECURITY.md` |
| Thí nghiệm đầu độc gợi ý | Tạo tài khoản ảo spam lượt xem để đẩy một sản phẩm lên gợi ý; đo trước và sau khi có lớp phòng thủ (giới hạn tốc độ, chỉ tính PURCHASE thật, lọc hành vi bất thường) |
| Runbook | `personalize-breaker` |

## Tuần này (đến hết 05/10)

- [ ] Bật xác thực hai bước (MFA) cho tài khoản GitHub
- [ ] Cài Python 3.13 và uv, Docker Desktop, AWS CLI v2. Clone repo, chạy `pnpm install`
- [ ] Đọc [git-flow.md](../git-flow.md), [hands-on-testing-guide.md](../hands-on-testing-guide.md), [ADR-0004](../adr/0004-goi-y-batch-truoc.md), [ADR-0009](../adr/0009-layer-hexagonal-rut-gon.md)
- [ ] Đọc `.github/CODEOWNERS` để biết GitHub sẽ mời bạn xem PR ở thư mục nào
- [ ] Mở console Amazon Personalize ở tài khoản của mình, thử **Create dataset group**, báo nhóm kết quả: Free plan có cho dùng không
- [ ] Threat model bản 0 (STRIDE) cho luồng đăng nhập, đặt hàng, ghi sự kiện, kèm bảng phân loại dữ liệu, đặt ở `docs/security/`
- [ ] Script sinh dữ liệu v1 trong `data/`: `pyproject.toml` (uv), pytest; bật khối `uv` trong `.github/dependabot.yml`
- [ ] Lab [000044 IAM Condition](https://000044.awsstudygroup.com/) và [000069 Bảo mật S3](https://000069.awsstudygroup.com/)
- [ ] Cùng nhóm viết nghiệp vụ phần gợi ý và sự kiện vào `docs/business/` trước 05/10
- [ ] Review trust policy OIDC An tạo trước khi An bật deploy

## Lộ trình 8 tuần

| Tuần | Việc | Xong khi |
|---|---|---|
| 1 · 29/09–05/10 | Danh sách tuần này | Biết Personalize dùng được không; threat model bản 0 đã merge; CI chạy được test Python |
| 2 · 06–12/10 | Sinh dữ liệu v2: logic theo persona, mua kèm GPU → PSU, thời gian trải nhiều tháng; chia train/test theo thời gian; baseline chạy offline | Có bảng chỉ số baseline đầu tiên |
| 3 · 13–19/10 | Module `events` (cùng An và Hoàng); ẩn danh bằng HMAC; bucket dữ liệu mã hoá KMS. Nếu được duyệt: import và train Personalize | Sự kiện ghi được trên dev |
| 4 · 20–26/10 | Pipeline mỗi đêm (EventBridge Scheduler → Lambda Python) ghi `recs` theo phiên bản; Personalize batch nếu có; review quyền IAM của mọi role | Widget của An hiện gợi ý do pipeline ghi |
| 5 · 27/10–02/11 | 5 rule WAF, giới hạn tốc độ cho `/api/events`; thí nghiệm đầu độc gợi ý; bộ test IDOR; xử lý kết quả ZAP | Báo cáo thí nghiệm có số liệu trước và sau |
| 6 · 03–09/11 | Chỉ số cuối AI so với baseline; Schemathesis; báo cáo bảo mật; tập demo campaign 1–2 giờ và kiểm tra cầu dao | Báo cáo bảo mật xong; không còn lỗi High/Critical |
| 7–8 · 10–23/11 | Workshop của mình; 3 blog; tập demo | Workshop xong |

## Cần học gì, học ở đâu

| Chủ đề | Học từ | Cần khi |
|---|---|---|
| IAM policy có điều kiện, quyền tối thiểu | Lab [000044](https://000044.awsstudygroup.com/) | Tuần 1 |
| Bảo mật S3, mã hoá KMS | Lab [000069](https://000069.awsstudygroup.com/); lab [000033](https://000033.awsstudygroup.com/) khi trang chạy lại | Tuần 1–3 |
| Threat model STRIDE, OWASP API Security Top 10 | Tài liệu OWASP | Tuần 1 |
| Luật mua kèm, đánh giá gợi ý (precision@k, coverage) | pandas; tài liệu về market basket analysis | Tuần 2 |
| Amazon Personalize | Tài liệu Amazon Personalize: User-Personalization-v2, Popularity-Count, batch inference | Tuần 3, nếu được duyệt |
| Powertools for AWS Lambda (Python) | Tài liệu chính thức của Powertools | Tuần 4 |
| AWS WAF | Lab [000026](https://000026.awsstudygroup.com/) | Tuần 4–5 |
| OWASP ZAP, Schemathesis | Tài liệu chính thức | Tuần 5–6 |

## Workshop và blog

- **Workshop:** Gợi ý mua kèm an toàn: pipeline dữ liệu ẩn danh và chống đầu độc dữ liệu
- **Blog 1 (tuần 3):** Ẩn danh dữ liệu người dùng trước khi đưa cho AI
- **Blog 2 (tuần 5):** Đầu độc dữ liệu gợi ý: thí nghiệm và cách chặn
- **Blog 3 (tuần 7):** Threat model STRIDE cho một web bán hàng serverless

## Làm tốt trông như thế nào

- Pipeline chạy mỗi đêm; chạy lại không nhân đôi dữ liệu; phiên bản kém hơn baseline không được bật
- Không dữ liệu cá nhân nào rời hệ thống khi chưa ẩn danh
- Thí nghiệm đầu độc gợi ý có số liệu trước và sau
- Khi phát hành, không còn lỗ hổng High hoặc Critical đang mở
- Mọi role IAM và trust policy đều đã được bạn review

## Những bẫy hay gặp

- **Kết luận "AI tốt hơn" từ dữ liệu giả lập tự cài quy luật.** Nói rõ đây là kiểm chứng pipeline; nếu kịp thì đo thêm trên bộ dữ liệu thật công khai.
- **Để campaign Personalize chạy qua đêm.** Khoảng $5–13 mỗi ngày. Luôn kiểm tra cầu dao sau mỗi buổi demo.
- **Commit dữ liệu thật hoặc file credentials.** Chỉ dùng dữ liệu giả lập; repo là public.
- **Báo lỗ hổng mà không kèm cách sửa.** Mỗi phát hiện là một issue có mức độ và cách sửa.
- **Làm bảo mật tách khỏi nhóm.** Mỗi tuần review vài PR của An và Hoàng từ góc bảo mật, góp ý sớm thay vì chặn muộn.

## Hướng đi sau dự án

- **Hướng nghề:** Cloud security hoặc data security engineer; hoặc MLOps nếu nghiêng về vận hành mô hình. Dự án cho bạn phần hiếm có: bảo vệ pipeline dữ liệu cho AI, kèm thí nghiệm có số liệu.
- **Chứng chỉ:** Cloud Practitioner hoặc AI Practitioner → **Security – Specialty** khi có thêm kinh nghiệm; hoặc Machine Learning Engineer – Associate nếu đi hướng ML.
- **Dòng CV gợi ý:** "Thiết kế pipeline dữ liệu gợi ý sản phẩm trên AWS với dữ liệu người dùng được ẩn danh (HMAC, KMS); đánh giá gợi ý so với baseline bằng precision@10; thực hiện threat model STRIDE, kiểm thử IDOR và OWASP ZAP; thí nghiệm đầu độc dữ liệu gợi ý cho thấy lớp phòng thủ giảm X% ảnh hưởng." Thay X bằng số đo được ở tuần 5.
