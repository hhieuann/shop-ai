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

## Bắt đầu

```bash
cd data
uv init --python 3.13
uv add --dev pytest ruff mypy
```

Khi đã có `pyproject.toml`, CI tự chạy ruff, mypy, pytest. Nhớ bật khối `uv` trong `.github/dependabot.yml`.
