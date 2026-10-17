# data

Phần dữ liệu và gợi ý, viết bằng Python 3.13, quản lý bằng uv. Nhân phụ trách.

## Nội dung dự kiến

| Thư mục | Làm gì |
|---|---|
| `generator/` | Sinh sản phẩm, khách hàng theo 4 persona và sự kiện tương tác có logic mua kèm |
| `model/` | Mô hình gợi ý tự xây ([ADR-0016](../docs/adr/0016-tu-xay-mo-hinh-goi-y.md)): luật mua kèm (support, confidence, lift) cho "Thường mua kèm"; gợi ý theo món tương tự cho "Dành cho bạn" |
| `baseline/` | Hàng bán chạy theo loại: gợi ý cho người mới, và là mốc để so sánh mô hình |
| `pipeline/` | Job mỗi đêm: gom sự kiện → kiểm dữ liệu → tính gợi ý → ghi bảng `recs` theo phiên bản → đổi con trỏ ACTIVE |
| `tests/` | pytest theo AAA+ |

## Quy tắc dữ liệu

- `user_id` ẩn danh bằng HMAC trước khi rời khỏi hệ thống; khoá HMAC nằm trong Parameter Store (SecureString)
- Không đưa email, số điện thoại, địa chỉ, giá vốn cho mô hình
- Bucket dữ liệu mã hoá bằng KMS; role của Lambda pipeline chỉ đọc đúng prefix cần
- Chỉ dùng dữ liệu giả lập; ghi rõ điều này trong báo cáo
- Không bật phiên bản gợi ý mới nếu chỉ số kém hơn baseline

## Đánh giá offline "Thường mua kèm"

```bash
cd data
uv run data --out generated --seed 42      # sinh dữ liệu giả lập, thư mục generated/ không commit
uv run data-eval --data generated          # luật mua kèm so với baseline bán chạy
```

Cách đo (chi tiết ở đầu `src/data/evaluate.py`): chỉ dùng đơn `confirmed`, chia train và test theo thời gian. Mỗi đơn test có từ 2 sản phẩm tạo các lượt hỏi: lấy lần lượt từng sản phẩm làm sản phẩm đang xem, các sản phẩm còn lại trong đơn là đáp án.

Kết quả lần đầu, 16/10/2026: seed 42, 600 người dùng, 104 sản phẩm, 896 đơn train, 199 đơn test, 210 lượt hỏi. Tham số: baseline 30 ngày, cặp sản phẩm phải chung ít nhất 2 đơn, confidence tối thiểu 0,05.

| Cách gợi ý | precision@10 | hit rate@10 | coverage |
|---|---|---|---|
| Baseline: bán chạy 30 ngày | 0.0200 | 0.1905 | 0.1058 |
| Luật mua kèm | 0.0495 | 0.3667 | 0.6538 |
| Luật mua kèm, thiếu luật thì dùng baseline | 0.0519 | 0.3905 | 0.6538 |

Đọc kết quả:

- Luật mua kèm cao hơn baseline ở cả ba chỉ số. Seed 1, 7, 2026 cho cùng xu hướng.
- precision@10 thấp vì mỗi đơn chỉ có 2–3 sản phẩm, nên mỗi lượt hỏi chỉ có 1–2 đáp án đúng trong 10 gợi ý.
- **Dữ liệu là giả lập và đã cài sẵn quy luật mua kèm** (ví dụ GPU → PSU), nên kết quả chỉ chứng minh pipeline chạy đúng, chưa chứng minh mô hình tốt hơn ngoài đời.
- Các ngưỡng trên là số tạm để chạy lần đầu, chưa chốt (recommendation.md mục 5).

## Đánh giá offline "Dành cho bạn"

```bash
uv run data-eval-for-you --data generated   # item-based CF so với baseline bán chạy
```

Cách đo (chi tiết ở đầu `src/data/evaluate_for_you.py`): train là `interactions_train.csv`, test là `interactions_test.csv`. Đáp án của một người dùng là các sản phẩm người đó mua trong test mà chưa từng tương tác trong train. Chỉ chấm người dùng đã có lịch sử; người mới dùng baseline. Điểm tương tác lấy trọng số lớn nhất mỗi cặp (người dùng, sản phẩm): xem 1, thêm giỏ 3, mua 5. Lấy lớn nhất thay vì cộng dồn để spam lượt xem không đẩy điểm lên (threat model E2).

Kết quả lần đầu, 17/10/2026: seed 42, 535 người dùng có lịch sử, chấm 92 người.

| Cách gợi ý | precision@10 | hit rate@10 | coverage |
|---|---|---|---|
| Baseline: bán chạy 30 ngày | 0.0207 | 0.1957 | 0.1635 |
| Item-based CF | 0.0435 | 0.3804 | 0.9423 |

Đọc kết quả:

- Item-based CF cao hơn baseline ở cả ba chỉ số với seed 42, 1, 7. Với seed 2026, precision@10 vẫn cao hơn (0.0540 so với 0.0490) nhưng hit rate thấp hơn một chút (0.4000 so với 0.4200), nên chưa thể nói CF luôn tốt hơn.
- Chỉ 92 người được chấm, nên số dao động nhiều giữa các seed.
- Trọng số 1, 3, 5 là số tạm, chưa chốt (recommendation.md mục 5). Cùng giới hạn như phần trên: dữ liệu giả lập, chỉ chứng minh pipeline chạy đúng.

## Bắt đầu

```bash
cd data
uv init --python 3.13
uv add --dev pytest ruff mypy
```

Khi đã có `pyproject.toml`, CI tự chạy ruff, mypy, pytest. Nhớ bật khối `uv` trong `.github/dependabot.yml`.
