# data

Phần dữ liệu và gợi ý, viết bằng Python 3.13, quản lý bằng uv. Nhân phụ trách.

## Nội dung dự kiến

| Thư mục | Làm gì |
|---|---|
| `generator/` | Sinh sản phẩm, khách hàng theo 4 persona và sự kiện tương tác có logic mua kèm |
| `model/` | Mô hình gợi ý tự xây ([ADR-0016](../docs/adr/0016-tu-xay-mo-hinh-goi-y.md)): luật mua kèm (support, confidence, lift) cho "Thường mua kèm"; gợi ý theo món tương tự cho "Dành cho bạn" |
| `baseline/` | Hàng bán chạy theo loại: gợi ý cho người mới, và là mốc để so sánh mô hình |
| `pipeline/` | Job mỗi đêm: gom sự kiện → kiểm dữ liệu → tính gợi ý → ghi bảng `recs` theo phiên bản → đổi con trỏ ACTIVE |
| `security/` | Thí nghiệm đầu độc gợi ý (`uv run data-poison`), kết quả ở `docs/security/poisoning-experiment.md` |
| `tests/` | pytest theo AAA+ |

## Quy tắc dữ liệu

- `user_id` ẩn danh bằng HMAC trước khi rời khỏi hệ thống; khoá HMAC nằm trong Parameter Store (SecureString)
- Không đưa email, số điện thoại, địa chỉ, giá vốn cho mô hình
- Bucket dữ liệu mã hoá bằng KMS; role của Lambda pipeline chỉ đọc đúng prefix cần
- Chỉ dùng dữ liệu giả lập; ghi rõ điều này trong báo cáo
- Không bật phiên bản gợi ý mới nếu chỉ số kém hơn baseline

## Sinh dữ liệu giả lập

```bash
cd data
uv run data --out generated --seed 42      # thư mục generated/ không commit
```

- Mặc định đọc danh mục thật `services/api/seed/catalog/products.json` (102 sản phẩm đang bán, bỏ 2 sản phẩm ngừng bán), nên mã sản phẩm trong dữ liệu khớp với web và bảng `recs`. Dùng file khác bằng `--products <đường dẫn>`. `--builtin` dùng danh mục tự chế (mã dạng `gpu-001`, không có trên web), chỉ để thử.
- `EVENT_TYPE` viết hoa như API: `VIEW`, `ADD_TO_CART`, `PURCHASE`. API không ghi việc bỏ khỏi giỏ nên dữ liệu cũng không có loại đó.
- Mọi cột thời gian (`TIMESTAMP`) là ISO 8601 UTC, dạng `2026-01-01T08:00:00.000Z`, giống bảng `events` (dynamodb-design.md).
- 10% người dùng là người mới (`IS_NEW = 1` trong `users.csv`): chỉ hoạt động sau mốc cắt train/test, dùng để thử gợi ý cho người mới. Đổi tỉ lệ bằng `--new-user-frac`.
- Trên Windows, lệnh tự chuyển console sang UTF-8 nên in tiếng Việt không lỗi.

## Đánh giá offline "Thường mua kèm"

```bash
uv run data-eval --data generated          # luật mua kèm so với baseline bán chạy
```

Cách đo (chi tiết ở đầu `src/data/evaluate.py`): chỉ dùng đơn `confirmed`, chia train và test theo thời gian. Mỗi đơn test có từ 2 sản phẩm tạo các lượt hỏi: lấy lần lượt từng sản phẩm làm sản phẩm đang xem, các sản phẩm còn lại trong đơn là đáp án.

Kết quả 21/10/2026, danh mục thật: seed 42, 600 người dùng, 102 sản phẩm, 800 đơn train, 282 đơn test, 357 lượt hỏi. Tham số: baseline 30 ngày, cặp sản phẩm phải chung ít nhất 2 đơn, confidence tối thiểu 0,05.

| Cách gợi ý | precision@10 | hit rate@10 | coverage |
|---|---|---|---|
| Baseline: bán chạy 30 ngày | 0.0300 | 0.2577 | 0.1078 |
| Luật mua kèm | 0.0448 | 0.3754 | 0.6667 |
| Luật mua kèm, thiếu luật thì dùng baseline | 0.0485 | 0.4090 | 0.6667 |

Đọc kết quả:

- Luật mua kèm cao hơn baseline ở cả ba chỉ số. Seed 1, 7, 2026 cho cùng xu hướng.
- Cách biệt nhỏ hơn bản 16/10 (danh mục tự chế: 0.0495 so với 0.0200), vì danh mục thật ít category hơn và không có category `case` nên một số luật mua kèm cài sẵn không áp dụng được.
- precision@10 thấp vì mỗi đơn chỉ có 2–3 sản phẩm, nên mỗi lượt hỏi chỉ có 1–2 đáp án đúng trong 10 gợi ý.
- **Dữ liệu là giả lập và đã cài sẵn quy luật mua kèm** (ví dụ GPU → PSU), nên kết quả chỉ chứng minh pipeline chạy đúng, chưa chứng minh mô hình tốt hơn ngoài đời.
- Các ngưỡng trên là số tạm để chạy lần đầu, chưa chốt (recommendation.md mục 5).

## Đánh giá offline "Dành cho bạn"

```bash
uv run data-eval-for-you --data generated   # item-based CF so với baseline bán chạy
```

Cách đo (chi tiết ở đầu `src/data/evaluate_for_you.py`): train là `interactions_train.csv`, test là `interactions_test.csv`. Đáp án của một người dùng là các sản phẩm người đó mua trong test mà chưa từng tương tác trong train. Người đã có lịch sử được chấm cả baseline và CF; người mới (không có sự kiện nào trong train) chỉ chấm baseline, vì CF cần lịch sử (ADR-0016). Điểm tương tác lấy trọng số lớn nhất mỗi cặp (người dùng, sản phẩm): xem 1, thêm giỏ 3, mua 5. Lấy lớn nhất thay vì cộng dồn để spam lượt xem không đẩy điểm lên (threat model E2).

Kết quả 21/10/2026, danh mục thật: seed 42, 489 người dùng có lịch sử. Chấm 84 người có lịch sử và 111 người chưa có lịch sử trong train: 59 người mới (`IS_NEW = 1`) và 52 người tình cờ có đơn đầu tiên sau mốc cắt.

| Cách gợi ý | precision@10 | hit rate@10 | coverage |
|---|---|---|---|
| Baseline: bán chạy 30 ngày | 0.0286 | 0.2381 | 0.1569 |
| Item-based CF | 0.0488 | 0.3810 | 0.8529 |
| Người mới (chưa có lịch sử): bán chạy 30 ngày | 0.0459 | 0.3243 | 0.0980 |

Đọc kết quả:

- Với người có lịch sử, item-based CF cao hơn baseline ở cả ba chỉ số với seed 42, 1, 7, 2026. Ở seed 1 cách biệt nhỏ (precision@10 0.0474 so với 0.0421).
- Dòng người mới chỉ cho biết baseline trả được gì cho người chưa có lịch sử, không so được với hai dòng trên vì là nhóm người khác. Coverage thấp vì mọi người mới nhận cùng một danh sách.
- Chỉ khoảng 80–100 người có lịch sử được chấm, nên số dao động nhiều giữa các seed.
- Trọng số 1, 3, 5 là số tạm, chưa chốt (recommendation.md mục 5). Cùng giới hạn như phần trên: dữ liệu giả lập, chỉ chứng minh pipeline chạy đúng.

## Cài và kiểm tra

```bash
cd data
uv sync                 # cài Python 3.13 và thư viện dev theo uv.lock
uv run ruff check .
uv run mypy .
uv run pytest
```

CI chạy đúng ba lệnh kiểm tra trên cho mỗi PR; Dependabot cập nhật thư viện qua khối `uv` trong `.github/dependabot.yml`.
