# ADR-0016: Tự xây mô hình gợi ý trên Lambda + DynamoDB, không dùng Amazon Personalize

- Trạng thái: Chấp nhận
- Ngày: 01/10/2026
- Người quyết: An, theo góp ý của mentor; Nhân thực hiện

## Bối cảnh

- Amazon Personalize tính tiền ở ba chỗ: dữ liệu đưa vào, giờ huấn luyện và campaign hosting. Campaign bị tính tối thiểu 1 request mỗi giây kể cả khi không ai gọi, khoảng $0,54/giờ với recipe v2.
- Personalize chỉ dùng được ở Paid plan. Tài khoản của cả nhóm đang ở Free plan, không bao giờ bị trừ tiền thẻ.
- Mentor (01/10/2026): nâng Paid plan cũng được, nhưng phải chú ý cách tính tiền của Personalize. Nếu chỉ cần gợi ý sản phẩm với chi phí thấp thì nên tự xây mô hình đơn giản trên Lambda + DynamoDB.
- Kiến trúc đã có sẵn chỗ cho việc này: gợi ý tính theo lô mỗi đêm, ghi vào bảng `recs`, API chỉ đọc bảng (ADR-0004).

## Quyết định

- Không dùng Amazon Personalize. Giữ Free plan ở cả 3 tài khoản.
- Nhân tự xây mô hình bằng Python, chạy trong Lambda mỗi đêm (EventBridge Scheduler):

| Gợi ý | Hiện ở đâu | Cách tính |
|---|---|---|
| Thường mua kèm | Trang chi tiết, giỏ hàng | Luật mua kèm từ các đơn đã đặt: đếm cặp sản phẩm nằm chung một đơn, xếp theo lift, lọc theo support và confidence tối thiểu |
| Dành cho bạn | Trang chủ | Gợi ý theo món tương tự (item-based collaborative filtering): độ tương tự cosine giữa các sản phẩm, tính từ lượt xem, thêm giỏ và mua đã ẩn danh |
| Người mới, chưa có dữ liệu | Trang chủ | Hàng bán chạy theo loại. Đây cũng là baseline để so sánh mô hình |

- Pipeline: gom sự kiện và đơn → kiểm dữ liệu → tính gợi ý → ghi top 10 vào `recs` theo phiên bản → đổi con trỏ ACTIVE nếu chỉ số không kém baseline.
- Đánh giá: chia train/test theo thời gian; đo precision@10 và coverage của mô hình so với baseline.

## Các lựa chọn đã cân nhắc

| Lựa chọn | Độ phức tạp | Chi phí | Hợp với nhóm |
|---|---|---|---|
| **Tự xây trên Lambda + DynamoDB** | Vừa: tự viết, tự đánh giá mô hình | Gần 0, nằm trong Always Free | Có; mentor khuyên |
| Personalize, chỉ chạy batch | Thấp: dịch vụ dựng sẵn | Vài USD, nhưng phải nâng Paid plan, có rủi ro vượt credit | Không |
| Personalize có campaign real-time | Thấp | Khoảng $394/tháng nếu quên tắt | Không |
| SageMaker | Cao: tự huấn luyện, tự vận hành endpoint | Endpoint thường tính tiền theo giờ chạy | Không |

## Hệ quả

- Dễ hơn: không phải nâng Paid plan, không có khoản tính tiền theo giờ, bỏ được Lambda cầu dao cho campaign. API và widget gợi ý không đổi.
- Khó hơn: nhóm tự chịu trách nhiệm chất lượng mô hình; gợi ý chỉ cập nhật mỗi đêm.
- Giới hạn cần nhớ: Lambda chạy tối đa 15 phút, gói code tối đa 250 MB khi giải nén. Quy mô demo (vài trăm sản phẩm, vài trăm nghìn sự kiện) nằm trong giới hạn này. Nếu thư viện như pandas, scikit-learn làm gói vượt 250 MB thì đóng gói Lambda bằng container image.
- Cần xem lại khi: dữ liệu vượt khả năng một lần chạy Lambda, hoặc cần gợi ý đổi ngay theo từng cú click.
- Thay phần Personalize trong ADR-0004.
