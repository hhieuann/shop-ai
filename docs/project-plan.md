# Kế hoạch dự án cuối kỳ FCAJ

**Dự án:** Shop linh kiện, thiết bị điện tử tích hợp AI gợi ý sản phẩm theo hành vi mua sắm (serverless trên AWS)
**Nhóm:** 3 người | **Thời hạn:** 8 tuần

> **Cập nhật 01/10/2026:** theo góp ý của mentor, nhóm không dùng Amazon Personalize mà tự xây mô hình gợi ý trên Lambda + DynamoDB ([ADR-0016](adr/0016-tu-xay-mo-hinh-goi-y.md)). Các đoạn nhắc tới Personalize bên dưới là kế hoạch ban đầu.

---

## 1. Ý tưởng

### Bài toán business

Shop nhỏ bán linh kiện máy tính và thiết bị điện tử (laptop, linh kiện PC, phụ kiện) không đủ nhân lực tư vấn "mua món này thì cần thêm gì". Đây là ngành có tỷ lệ mua kèm (cross-sell) rất cao — mua laptop thường cần thêm túi đựng, chuột; mua CPU/GPU thường cần nâng cấp nguồn (PSU) đi kèm. Khách không biết mình cần thêm gì, còn shop mất doanh thu bán chéo vì không có công cụ gợi ý như các sàn lớn.

### Luận điểm cần chứng minh

Amazon Personalize giúp shop nhỏ tự động hóa việc gợi ý sản phẩm liên quan và sản phẩm mua kèm dựa trên hành vi mua sắm, mà không cần tự xây dựng thuật toán ML từ đầu. Đây là điểm AWS thắng rõ so với cách làm truyền thống (tự code hoặc không có gợi ý gì).

### Lịch sử quyết định (ADR)

- **ADR-001 — Ngành hàng:** ban đầu chọn đặc sản theo mùa (traffic đột biến dễ chứng minh serverless), sau đổi sang linh kiện/thiết bị điện tử khi đổi hướng AI sang hệ thống gợi ý (xem ADR-002).
- **ADR-002 — Hướng AI:** đổi từ chatbot RAG (tư vấn dựa trên catalog và chính sách shop) sang hệ thống gợi ý (recommendation) học theo hành vi mua sắm của khách, dùng Amazon Personalize. Lý do: nhóm muốn AI học trực tiếp từ dữ liệu khách hàng thay vì chủ đề theo mùa, và đây là bài toán AI kinh điển, có dịch vụ AWS chuyên biệt (Personalize), không phụ thuộc tin tức hay dữ liệu bên ngoài nên không phát sinh chi phí như lo ngại ban đầu.
- **ADR-003 — Ngành hàng (chốt lại):** khi đổi sang recommendation, chọn lại ngành theo tiêu chí "có tính mua kèm/mua lặp lại rõ ràng, danh mục đủ lớn, dễ tạo persona khách hàng". Linh kiện/thiết bị điện tử được chọn vì có câu chuyện cross-sell trực quan, dễ giải thích trước giám khảo (mua laptop → gợi ý chuột/túi; mua GPU → gợi ý nâng cấp PSU).

---

## 2. Danh mục sản phẩm và persona khách hàng

### Danh mục (category)

- Laptop / PC dựng sẵn
- Linh kiện PC: CPU, GPU, RAM, ổ cứng (SSD/HDD), mainboard, nguồn (PSU), tản nhiệt
- Thiết bị ngoại vi: bàn phím, chuột, màn hình, tai nghe
- Phụ kiện: túi/balo laptop, hub USB, cáp, đế tản nhiệt

### Persona khách hàng (dùng để sinh dữ liệu giả lập có logic)

| Persona | Xu hướng quan tâm |
|---|---|
| Gamer | GPU, màn hình tần số quét cao, bàn phím cơ, tai nghe gaming |
| Dân văn phòng | Laptop mỏng nhẹ, chuột, túi đựng, hub USB-C |
| Sinh viên kỹ thuật/lập trình | RAM, SSD nâng cấp, màn hình phụ, laptop tầm trung |
| Content creator/thiết kế | GPU dựng hình, màn hình màu chuẩn, ổ cứng dung lượng lớn, tản nhiệt |

---

## 3. Phạm vi

| Có làm | Không làm (ghi là "hướng mở rộng") |
|---|---|
| Duyệt, tìm sản phẩm, giỏ hàng, đặt hàng | Thanh toán thật (dùng COD hoặc giả lập) |
| Đăng ký, đăng nhập, phân quyền khách/admin (Cognito) | Kiểm tra tương thích linh kiện (compatibility checker) |
| Ghi nhận sự kiện tương tác (view/cart/purchase) | Quản lý kho phức tạp, bảo hành, đổi trả |
| Gợi ý sản phẩm bằng Amazon Personalize | App mobile |
| Sinh dữ liệu giả lập theo persona | |
| Xử lý đơn bất đồng bộ (SQS/SNS, email xác nhận) | |
| Admin cơ bản: thêm sản phẩm, xem đơn | |
| Giám sát, cảnh báo, CI/CD, IaC | |
| Benchmark so với bản đối chứng | |

---

## 4. Kiến trúc

```
Người dùng → CloudFront (+WAF) → S3 (frontend)
                    ↓
              API Gateway (Cognito authorizer)
                    ↓
   Lambda: products | cart | orders | recommendations
        ↓                ↓                    ↓
   DynamoDB         SQS → Lambda      Personalize Campaign
                    → SNS/SES          (train từ S3 Interactions/Items)
                                              ↑
                            Lambda ghi event tương tác
                            (view/cart/purchase) → S3

Xuyên suốt: CloudWatch, X-Ray, Secrets Manager, KMS, CDK, CodePipeline
```

**Bản đối chứng:**
- Hạ tầng: 1 EC2 chạy Node.js + MySQL, luồng xem sản phẩm và đặt hàng, dùng cho load test.
- Gợi ý: baseline rule-based (sản phẩm bán chạy nhất trong category, hoặc gợi ý ngẫu nhiên), dùng để so sánh chất lượng gợi ý AI vs không AI.

### Công nghệ

| Lớp | Lựa chọn |
|---|---|
| Frontend | Next.js/React + TypeScript (S3 + CloudFront) |
| Backend | Node.js + TypeScript trên AWS Lambda |
| Database | DynamoDB |
| Auth | Amazon Cognito |
| AI | Amazon Personalize (User-Personalization, Similar-Items) |
| IaC / CI-CD | AWS CDK, CodePipeline |

### Ánh xạ nhu cầu business với dịch vụ AWS

| Nhu cầu business | Dịch vụ | Điểm nổi bật so với cách thường |
|---|---|---|
| Chịu tải đột biến | Lambda, API Gateway, DynamoDB, CloudFront | Tự scale, không cần đoán trước công suất |
| Chi phí thấp khi ít khách | Serverless (trả theo lượt dùng) | Server truyền thống tốn tiền cả lúc vắng khách |
| Đăng nhập, phân quyền | Cognito, IAM | Không tự viết và bảo trì hệ thống auth |
| Bảo vệ khỏi tấn công | WAF, KMS, Secrets Manager, GuardDuty | Bảo mật tích hợp sẵn |
| Xử lý đơn bất đồng bộ | SQS, SNS | Đơn hàng không mất khi quá tải |
| Triển khai lặp lại được | CDK/CloudFormation, CodePipeline | Dựng cả hệ thống bằng 1 lệnh, rollback dễ |
| Giám sát, cảnh báo | CloudWatch, X-Ray | Thấy lỗi trước khi khách phàn nàn |
| Kiểm soát chi phí | Cost Explorer, Budgets | Biết chi phí mỗi đơn hàng |
| Gợi ý sản phẩm cá nhân hóa | Amazon Personalize | Không cần tự xây thuật toán ML, có sẵn recipe tối ưu |

> Nên kiểm tra tài liệu AWS hiện hành vì các dịch vụ AI đổi tên và tính năng khá nhanh.

---

## 5. Dữ liệu và Amazon Personalize

### Dataset

- **Items:** item_id, category, sub_category, price, brand
- **Interactions:** user_id, item_id, event_type (VIEW, ADD_TO_CART, PURCHASE), timestamp
- **Users (tùy chọn):** user_id, thông tin nhân khẩu học nếu có

### Logic sinh dữ liệu giả lập

1. Tạo khoảng 80-120 sản phẩm trải đều các category ở mục 2.
2. Tạo khoảng 300-500 khách hàng ảo, mỗi khách gán 1 persona.
3. Với mỗi khách, sinh event tương tác: 70% rơi vào category liên quan đến persona, 30% ngẫu nhiên (tạo nhiễu thực tế).
4. Thêm logic "mua kèm" có chủ đích cho một số đơn (ví dụ mua GPU thì 40% có thêm PSU trong cùng đơn) để Personalize học được pattern cross-sell rõ ràng, dễ demo.
5. Random timestamp trải dài vài tháng.

> Ghi rõ trong báo cáo: đây là dữ liệu giả lập có logic thiết kế, phục vụ mục đích demo do dự án chưa có người dùng thật. Trung thực về điều này quan trọng hơn là giấu đi.

### Quy trình Personalize

1. Import Items và Interactions từ S3 vào Dataset Group
2. Chọn recipe: `User-Personalization` (gợi ý cá nhân hóa trang chủ), `Similar-Items` (gợi ý trên trang chi tiết sản phẩm), tùy thời gian có thể thêm `Personalized-Ranking`
3. Train solution (tốn thời gian thật, cần dự trù buffer)
4. Tạo Campaign để gọi API `GetRecommendations` real-time từ Lambda

---

## 6. Cách chứng minh "AWS nổi bật hơn"

1. **Offline metrics:** so sánh precision, recall, coverage giữa các recipe Personalize và so với baseline rule-based (Personalize tự xuất báo cáo này sau khi train).
2. **Demo trực quan cross-sell:** cho xem một khách persona cụ thể (ví dụ "gamer") — gợi ý ra đúng GPU/tai nghe gaming, so với baseline chỉ ra sản phẩm bán chạy chung chung.
3. **Thời gian và công sức:** so sánh thời gian cấu hình Personalize với thời gian ước tính nếu tự code collaborative filtering từ đầu.
4. **Load test** (k6/Artillery) ở 100 → 1.000 → 10.000 người dùng, so AWS serverless với bản EC2: thời gian phản hồi, tỷ lệ lỗi, khả năng tự scale.
5. **So sánh chi phí (TCO)** tháng thường và tháng cao điểm bằng AWS Pricing Calculator, nêu trung thực cả trường hợp server cố định rẻ hơn.
6. **Phục hồi sự cố:** tắt một thành phần hoặc xóa nhầm dữ liệu, đo thời gian khôi phục.
7. **Tốc độ triển khai:** dựng cả môi trường bằng CDK so với cài tay.

Trình bày kết quả bằng bảng và biểu đồ.

---

## 7. Nguyên lý lập trình và quy trình phát triển (áp dụng vừa đủ)

| Thực hành | Cách làm gọn cho 8 tuần |
|---|---|
| Agile/Scrum nhẹ | 4 sprint × 2 tuần, họp đứng ngắn, backlog trên Jira/Trello/GitHub Projects |
| User story + tiêu chí hoàn thành | "Là khách hàng, tôi muốn... để...", kèm điều kiện nghiệm thu |
| Git workflow | Nhánh feature, Pull Request, mỗi PR có ít nhất 1 người review |
| Tách lớp | Handler → service → repository, inject DynamoDB client để dễ test |
| SOLID, DRY | Áp dụng vừa phải |
| Kiểm thử có chọn lọc | Unit test cho tính giá, xử lý đơn, kiểm tồn kho; vài integration test cho luồng đặt hàng |
| IaC + CI/CD | Mọi thứ bằng CDK, push code là tự test và deploy |
| ADR | Ghi mỗi quyết định kiến trúc: chọn gì, vì sao, đánh đổi gì |

**Tránh:** microservices cho có, TDD cực đoan, tài liệu quá dày.

---

## 8. Phân công nhóm

| Thành viên | Phụ trách |
|---|---|
| **A: Hạ tầng và bảo mật** | CDK, IAM, Cognito, WAF, CI/CD, CloudWatch, chi phí, benchmark |
| **B: Backend nghiệp vụ** | Lambda sản phẩm/giỏ hàng/đơn hàng, DynamoDB, SQS/SNS, kiểm thử |
| **C: Dữ liệu và AI** | Thiết kế persona, script sinh dữ liệu giả lập, setup Personalize, tích hợp API gợi ý, đọc và giải thích offline metrics |

Mọi người review code của nhau để ai cũng trả lời được câu hỏi của giám khảo.

---

## 9. Lộ trình 8 tuần

| Tuần | Mục tiêu | Bàn giao |
|---|---|---|
| 1 | Chốt danh mục sản phẩm, thiết kế persona, backlog, kiến trúc, CDK khung, budget alert | Danh sách category + persona, tài liệu kiến trúc |
| 2–3 | **Sprint 1:** Cognito, API sản phẩm, giao diện xem/tìm, CI/CD cơ bản | Luồng xem sản phẩm trên cloud |
| 4–5 | **Sprint 2:** giỏ hàng, đặt hàng, Lambda ghi event tương tác, bắt đầu setup Personalize (import data, train sớm), dựng bản đối chứng EC2 | Luồng đặt hàng trọn vẹn, Personalize đã train lần đầu |
| 6 | **Sprint 3:** tạo Campaign, tích hợp API gợi ý vào frontend, baseline rule-based, WAF, giám sát | Gợi ý sản phẩm chạy trên web |
| 7 | Đo offline metrics, load test, đo chi phí, thử kịch bản lỗi và phục hồi | Bảng và biểu đồ so sánh |
| 8 | Viết báo cáo, làm slide, tập thuyết trình, chuẩn bị demo dự phòng | Bản nộp cuối |

### Rủi ro chính

- Thời gian train Personalize không kiểm soát hoàn toàn: bắt đầu import và train từ tuần 4-5, không đợi tuần 6.
- Dồn benchmark và báo cáo vào tuần cuối: dựng bản đối chứng và script load test sớm.
- Personalize có phí theo dung lượng dữ liệu, giờ train và giờ Campaign chạy: xóa Campaign khi không demo, đặt budget alert riêng.
- Hóa đơn AWS bất ngờ: đặt budget alert ngay ngày đầu, tắt tài nguyên không dùng.

---

## 10. Cấu trúc báo cáo "level business"

1. Vấn đề và khách hàng mục tiêu (kèm số liệu thị trường nếu có)
2. Giải pháp và giá trị mang lại
3. Kiến trúc AWS và lý do chọn từng dịch vụ
4. Phân tích chi phí, mô hình doanh thu, điểm hòa vốn
5. So sánh với cách truyền thống (số liệu benchmark, offline metrics)
6. Rủi ro, bảo mật, tuân thủ, giới hạn của dữ liệu giả lập
7. Hướng mở rộng (compatibility checker, dữ liệu người dùng thật, thanh toán thật...)

---

## 11. Việc cần làm ngay tuần này

- [ ] Chốt danh sách category cụ thể và số lượng sản phẩm mẫu
- [ ] Chốt 4 persona khách hàng và tỷ lệ tương tác của từng persona
- [ ] Tạo repo, board backlog, quy ước Git
- [ ] Đặt budget alert AWS, thống nhất cách chia credit/tài khoản
- [ ] Hỏi mentor FCAJ tiêu chí chấm cụ thể để điều chỉnh trọng số giữa business, kỹ thuật và thuyết trình

---

## 12. Giá trị cho CV sau này

Cách ghi gợi ý (thay X, Y, Z bằng số liệu thật từ benchmark):

> Xây dựng nền tảng e-commerce serverless (Lambda, DynamoDB, Cognito) tích hợp hệ thống gợi ý sản phẩm bằng Amazon Personalize; cải thiện precision gợi ý X% so với baseline rule-based; chi phí vận hành dưới Y USD/tháng; chịu được Z người dùng đồng thời; triển khai bằng CDK và CI/CD.

Nhà tuyển dụng đánh giá cao: dự án deploy thật, có số liệu, phần AI có chiều sâu (không chỉ gọi API AI có sẵn mà hiểu recommendation system), thực hành kỹ thuật chuyên nghiệp (IaC, CI/CD, test, monitoring), README có mục "quyết định thiết kế, đánh đổi và sai lầm".

---

## Bước tiếp theo gợi ý

- Viết backlog user story cho 4 sprint
- Thiết kế bảng DynamoDB (sản phẩm, giỏ hàng, đơn hàng)
- Viết script sinh dữ liệu giả lập theo persona (nên bắt đầu sớm nhất)
- Vẽ sơ đồ kiến trúc chi tiết
