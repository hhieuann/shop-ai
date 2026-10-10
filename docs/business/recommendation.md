# Gợi ý mua kèm — cách hoạt động

> Bản 0. Dựa theo `docs/team/nhan.md`, ADR-0004 (gợi ý chạy batch trước), ADR-0009
> (modular monolith, Hexagonal rút gọn — module `recommendation` là một Lambda
> riêng, có bảng DynamoDB riêng) và ADR-0016 (tự xây mô hình, không dùng
> Personalize). Các mục còn đánh dấu "giả định" ở cuối file là thật sự chưa có
> nguồn nào xác nhận, không phải do chưa đọc tài liệu.

## 1. Gợi ý hiện ở đâu

| Vị trí trên web | Loại gợi ý | Input |
|---|---|---|
| Trang chủ, trang cá nhân | "Dành cho bạn" | `userId` đã đăng nhập (ẩn danh hoá, xem `events.md`) |
| Trang chi tiết sản phẩm | "Thường mua kèm" | `itemId` đang xem |
| Khách chưa đăng nhập / user mới / category mới (cold-start) | Hàng bán chạy (baseline) | `categoryId` (tuỳ chọn) |

## 2. Cách tính từng loại

### 2.1. "Thường mua kèm" — luật mua kèm (association rules)

- Input: `order_items` của các đơn có trạng thái `confirmed`.
- Tính `support`, `confidence`, `lift` cho từng cặp sản phẩm (hoặc cặp category, tuỳ độ thưa dữ liệu).
- Lọc theo `support` và `confidence` tối thiểu, xếp hạng theo `lift` (đúng theo ADR-0016: "đếm cặp sản phẩm nằm chung một đơn, xếp theo lift, lọc theo support và confidence tối thiểu"). **Con số ngưỡng cụ thể chưa được chốt ở đâu cả** — không phải mình quên đọc, mà thật sự chưa có ai quyết định; sẽ thử trên dữ liệu thật để chọn.
- Ghi **top 10** cho mỗi sản phẩm (đúng số lượng ADR-0016 ghi rõ).
- **Không dùng thư viện nặng** (`mlxtend` chỉ dùng để đối chiếu kết quả lúc phát triển, không đóng gói vào Lambda) — tự viết bằng Python thuần/`collections.Counter` để tránh vượt giới hạn 250 MB của Lambda.

### 2.2. "Dành cho bạn" — item-based collaborative filtering

- Input: ma trận tương tác user–item, dựng từ `events` đã **ẩn danh** (`VIEW`, `ADD_TO_CART`, `PURCHASE` — đúng nguyên văn ADR-0016: "tính từ lượt xem, thêm giỏ và mua đã ẩn danh").
- Tính độ tương tự cosine giữa các **sản phẩm** (item-based, không phải user-based) dựa trên vector tương tác của người dùng với từng sản phẩm.
- Với một user, lấy các sản phẩm họ đã tương tác gần đây, tìm sản phẩm tương tự nhất mà họ **chưa** tương tác, xếp hạng theo điểm tương tự.
- Dùng `numpy` cho phép tính ma trận, không cần `scikit-learn` (ADR-0016: Lambda giới hạn 250 MB khi giải nén, thư viện nặng dễ vượt giới hạn).
- **Trọng số riêng cho từng loại sự kiện (ví dụ VIEW/ADD_TO_CART/PURCHASE khác nhau bao nhiêu) chưa được chốt ở đâu** — cần thử nghiệm.

### 2.3. Baseline — hàng bán chạy theo category

- Đếm số `PURCHASE` theo `itemId` trong N ngày gần nhất (ví dụ 30 ngày), nhóm theo category.
- Dùng khi: user mới chưa có lịch sử, category mới chưa đủ dữ liệu cho hai mô hình trên, hoặc khi một phiên bản mô hình không vượt qua được baseline (xem mục 3).
- Baseline **luôn được tính**, kể cả khi hai mô hình trên chạy tốt, vì nó là mốc so sánh bắt buộc (mục 4).

## 3. Đầu ra — bảng `recs`

Tên bảng `recs` **đã chốt sẵn** trong ADR-0012 (danh sách 6 bảng: `products`,
`carts`, `orders`, `idempotency`, `events`, `recs`), không phải đề xuất của tài
liệu này. Theo ADR-0009, module `recommendation` là một Lambda riêng với bảng
DynamoDB riêng, module khác không được import code của module này — muốn đọc
`recs` phải qua cửa công khai (API) hoặc port.

**Khoá chính và GSI của `recs` chưa được thiết kế** — ADR-0012 ghi nguyên văn
"bảng chi tiết sẽ chốt khi có nghiệp vụ", xác nhận đây thật sự chưa ai làm, không
phải mình bỏ sót. Cột bên dưới là **đề xuất của mình**, cần Hoàng/An xác nhận
trước khi coi là thiết kế chính thức. Có **version** và **con trỏ ACTIVE**, không
ghi đè trực tiếp:

| Cột | Ý nghĩa |
|---|---|
| `recType` | `FOR_YOU` \| `ALSO_BOUGHT` \| `BESTSELLER` |
| `anchorId` | `userId` đã ẩn danh (nếu `FOR_YOU`) hoặc `itemId` (nếu `ALSO_BOUGHT`/`BESTSELLER` theo category) |
| `rank` | Thứ hạng trong danh sách |
| `itemId` | Sản phẩm được gợi ý |
| `score` | Điểm (lift, cosine similarity, hoặc số lượt mua) |
| `version` | Số phiên bản, tăng dần mỗi lần job chạy |
| `isActive` | `true` cho đúng một version mỗi `(recType, anchorId)` tại một thời điểm |
| `generatedAt` | Thời điểm tính |

**Vòng đời một lần chạy job đêm:**
1. Tính phiên bản mới (version N+1), ghi vào bảng với `isActive = false`.
2. Tính `precision@10` và `coverage` của version N+1 trên tập test, so với baseline **và** so với version đang ACTIVE.
3. Nếu version N+1 không kém hơn baseline → chuyển `isActive = true` cho N+1, chuyển `isActive = false` cho version đang active trước đó (giữ lại để rollback thủ công nếu cần).
4. Nếu kém hơn baseline → **không kích hoạt**, giữ nguyên version đang chạy, ghi log/cảnh báo.
5. Idempotent: chạy lại cùng một ngày với cùng dữ liệu đầu vào không được tạo thêm bản ghi trùng (dùng `version` hoặc khoá theo ngày để kiểm tra đã chạy chưa trước khi ghi).

## 4. Đánh giá

- **Chỉ số:** `precision@10` và `coverage`.
- **Tập test:** chia theo thời gian (không chia ngẫu nhiên) — mọi tương tác trước mốc cắt là train, sau mốc là test, để mô phỏng đúng việc dự đoán tương lai từ quá khứ.
- **So sánh:** mô hình (luật mua kèm / item-based CF) so với baseline (hàng bán chạy) trên cùng tập test, cùng chỉ số.
- **Giới hạn cần nêu trong báo cáo:** nếu dùng dữ liệu giả lập tự sinh (có cài sẵn quy luật), kết quả chỉ chứng minh pipeline chạy đúng, chưa chứng minh mô hình tốt hơn ngoài đời. Nếu kịp, đối chiếu thêm trên một bộ dữ liệu thật công khai.

## 5. Thật sự chưa biết, cần hỏi (không phải do chưa đọc tài liệu)

- [ ] Ngưỡng `support`/`confidence` ở mục 2.1 — không ADR nào ghi số cụ thể, cần thử trên dữ liệu thật.
- [ ] Trọng số `VIEW`/`ADD_TO_CART`/`PURCHASE` ở mục 2.2 — tương tự, cần thử nghiệm.
- [ ] Khoá chính và GSI thật của bảng `recs` — **xác nhận chưa ai thiết kế** (ADR-0012: "bảng chi tiết sẽ chốt khi có nghiệp vụ"). Vì `recommendation` là module của mình, nhiều khả năng mình là người đề xuất thiết kế này trước, theo đúng cách Hoàng đã làm cho `products`/`carts`/`orders` trong `dynamodb-design.md`.
- [ ] N ngày cho baseline "bán chạy" (ADR-0016 không ghi số ngày cụ thể).
- [ ] Route API để web đọc `recs` (`GET /api/v1/recs/...` hay tương tự) — chưa có trong `contracts/openapi.yaml` (đã kiểm tra bản mới nhất sau `git pull` ngày 09/10/2026).
- [ ] Câu hỏi 4 trong `docs/business/dynamodb-design.md` (Hoàng hỏi trực tiếp) về cách `ordering` báo cho `events` khi đơn `CONFIRMED` — xem đề xuất trong `events.md` mục 1, ảnh hưởng gián tiếp tới `recommendation` vì đó là nguồn dữ liệu `PURCHASE` cho cả luật mua kèm lẫn item-based CF.
