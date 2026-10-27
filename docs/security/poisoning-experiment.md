# Thí nghiệm đầu độc gợi ý (threat model E2)

Người viết: Nhân · Ngày: 27/10/2026 · Code: `data/src/data/security/poisoning.py`, chạy lại bằng `cd data && uv run data-poison --seed <n>`.

## Câu hỏi

Kẻ tấn công tạo nhiều tài khoản, spam `VIEW`, `ADD_TO_CART` một sản phẩm ít người mua (mục tiêu). Mục tiêu có lọt vào gợi ý của người dùng thật không, và các lớp phòng thủ hiện có chặn được tới đâu?

## Cách làm

- Dữ liệu: generator giả lập (600 người dùng, 365 ngày, danh mục thật 102 sản phẩm), đổi sang sự kiện như pipeline đọc (`synthetic_events`).
- Mục tiêu: sản phẩm ít người mua nhất. Mỗi tài khoản ảo xem mục tiêu cùng 5 món bán chạy nhất (để item-based CF coi mục tiêu "giống" các món đó), lặp `repeats` lần, rồi thêm giỏ mục tiêu một lần. Không có `PURCHASE` vì API chặn (E1, đã có E2E `events.e2e.ts`).
- Gợi ý được tính đúng như pipeline ghi bảng `recs` (`for_you`, `also_bought` trong `data/src/data/pipeline/build.py`, top 10, thiếu thì bù hàng bán chạy).
- Đo:
  - **Exposure "Dành cho bạn"**: % người dùng thật có mục tiêu trong top 10;
  - **"Thường mua kèm"**: số sản phẩm có mục tiêu trong top 10.
- So hai cách gộp sự kiện của một cặp (người dùng, sản phẩm): `sum` cộng dồn mọi lượt (cách hay gặp) và `max` lấy trọng số lớn nhất (cách pipeline đang dùng).

## Kết quả (seed 42)

| Tài khoản ảo | Lặp mỗi tài khoản | Gộp `sum` | Gộp `max` (đang dùng) | Thường mua kèm |
|---|---|---|---|---|
| 0 | – | 5.0% | 3.3% | 0 |
| 5 | 1 | 0.0% | 0.0% | 0 |
| 5 | 50 | 37.5% | 0.0% | 0 |
| 20 | 1 | 0.0% | 0.0% | 0 |
| 20 | 50 | 38.3% | 0.0% | 0 |
| 50 | 1 | 0.0% | 1.7% | 0 |
| 50 | 50 | 38.8% | 1.7% | 0 |

Bốn seed (42, 1, 7, 2026), 50 tài khoản × 50 lần lặp: `sum` 38.8% – 43.2%, `max` 0.3% – 2.0%; không tấn công: `max` 0% – 3.3%.

## Kết luận

1. **Spam lặp lại bị chặn bởi cách gộp `max`.** Với `sum`, 5 tài khoản spam 50 lần đã đưa mục tiêu tới khoảng 38% người dùng thật; với `max`, lặp lại không tăng điểm nên exposure không vượt mức lúc chưa tấn công.
2. **"Thường mua kèm" không bị ảnh hưởng** vì chỉ học từ `PURCHASE`, mà `PURCHASE` chỉ đến từ đơn đã xác nhận (consumer #252); client gửi `PURCHASE` bị 400.
3. **Rủi ro còn lại là số lượng tài khoản.** 50 tài khoản mỗi cái xem 1 lần làm exposure nhích lên tối đa 2.0% ở một số seed. Chặn bằng: rule WAF giới hạn tần suất cho `/api/v1/events` (dời sang v1.0.0-rc.1), chi phí tạo tài khoản (Cognito, xác minh email), và theo dõi số tài khoản mới có sự kiện tăng đột biến.

## Giới hạn

- Dữ liệu giả lập, đã cài sẵn quy luật mua kèm; con số cho thấy cơ chế, không phải mức thiệt hại thật.
- Chỉ thử một kiểu tấn công (xem kèm món bán chạy). Kiểu khác (tài khoản ảo mua thật bằng COD rồi huỷ) đi qua `PURCHASE`; đơn huỷ không phát `order-confirmed` nên không thành sự kiện mua, nhưng đơn được xác nhận rồi mới huỷ thì vẫn tính, chưa thử.
