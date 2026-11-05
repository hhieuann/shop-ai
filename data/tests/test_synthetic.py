"""Test cho data.generator.synthetic — viết theo AAA (Arrange, Act, Assert)."""
import csv
import io
import json
import re
from datetime import datetime
from pathlib import Path

import pytest

from data.console import use_utf8_output
from data.generator.synthetic import (
    DEFAULT_PRODUCTS,
    Item,
    cli,
    load_real_catalog,
    main,
    remap_personas_and_rules,
    resolve_category,
)

ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


# --------------------------------------------------------------------------
# Tái lập: cùng seed phải ra cùng kết quả (bắt buộc cho chia train/test ổn định)
# --------------------------------------------------------------------------
def test_same_seed_sinh_ra_cung_du_lieu(tmp_path):
    # Arrange
    out1, out2 = tmp_path / "run1", tmp_path / "run2"

    # Act
    main(["--out", str(out1), "--seed", "7", "--users", "40"])
    main(["--out", str(out2), "--seed", "7", "--users", "40"])

    # Assert
    for name in ("orders.csv", "order_items.csv", "interactions_train.csv"):
        assert (out1 / name).read_text() == (out2 / name).read_text(), (
            f"{name} phải giống hệt nhau khi dùng cùng seed"
        )


def test_khac_seed_ra_du_lieu_khac(tmp_path):
    # Arrange
    out1, out2 = tmp_path / "run1", tmp_path / "run2"

    # Act
    main(["--out", str(out1), "--seed", "1", "--users", "40"])
    main(["--out", str(out2), "--seed", "2", "--users", "40"])

    # Assert
    assert (out1 / "orders.csv").read_text() != (out2 / "orders.csv").read_text()


# --------------------------------------------------------------------------
# Chia train/test theo thời gian: không được rò rỉ dữ liệu tương lai vào train
# --------------------------------------------------------------------------
def test_khong_ro_ri_thoi_gian_giua_train_va_test(tmp_path):
    # Arrange
    out = tmp_path / "run"
    main(["--out", str(out), "--seed", "42", "--users", "80"])
    train = read_csv(out / "interactions_train.csv")
    test = read_csv(out / "interactions_test.csv")

    # Act
    max_train_ts = max(datetime.fromisoformat(r["TIMESTAMP"]) for r in train)
    min_test_ts = min(datetime.fromisoformat(r["TIMESTAMP"]) for r in test)

    # Assert
    assert max_train_ts < min_test_ts


# --------------------------------------------------------------------------
# Luật nghiệp vụ: PURCHASE chỉ sinh từ đơn confirmed, không sinh từ đơn cancelled
# --------------------------------------------------------------------------
def test_don_huy_khong_sinh_su_kien_purchase(tmp_path):
    # Arrange
    out = tmp_path / "run"
    main(["--out", str(out), "--seed", "42", "--users", "200"])
    orders = read_csv(out / "orders.csv")
    cancelled_ids = {r["ORDER_ID"] for r in orders if r["STATUS"] == "cancelled"}
    assert cancelled_ids, "cần ít nhất 1 đơn huỷ để test này có ý nghĩa"

    order_items = read_csv(out / "order_items.csv")
    purchase_events = read_csv(out / "interactions_train.csv") + read_csv(out / "interactions_test.csv")

    # Act: đếm số dòng order_items thuộc đơn confirmed (chỉ nguồn hợp lệ cho PURCHASE)
    orders_by_id = {r["ORDER_ID"]: r for r in orders}
    confirmed_item_rows = sum(
        1 for row in order_items if orders_by_id[row["ORDER_ID"]]["STATUS"] == "confirmed"
    )
    assert len(purchase_events) >= 0  # sanity
    n_purchase = sum(1 for e in purchase_events if e["EVENT_TYPE"] == "PURCHASE")
    assert n_purchase == confirmed_item_rows


# --------------------------------------------------------------------------
# Ẩn danh: không có cột nào trong các file xuất ra chứa PERSONA cạnh USER_ID
# của bảng tương tác (users.csv có PERSONA, nhưng đó là file kiểm tra riêng,
# không phải file "giao cho AI")
# --------------------------------------------------------------------------
def test_file_tuong_tac_khong_co_cot_persona(tmp_path):
    # Arrange
    out = tmp_path / "run"
    main(["--out", str(out), "--seed", "42", "--users", "30"])

    # Act
    with (out / "interactions_train.csv").open(encoding="utf-8") as f:
        header = f.readline().strip().split(",")

    # Assert
    assert "PERSONA" not in header
    assert header == ["USER_ID", "ITEM_ID", "TIMESTAMP", "EVENT_TYPE"]


# --------------------------------------------------------------------------
# resolve_category: ánh xạ tên chuẩn sang tên thật trong danh mục đã nạp
# --------------------------------------------------------------------------
def test_resolve_category_uu_tien_ten_chuan_truoc_alias():
    # Arrange
    catalog_keys = {"ssd", "storage"}

    # Act
    result = resolve_category("ssd", catalog_keys)

    # Assert
    assert result == "ssd"


def test_resolve_category_dung_alias_khi_khong_co_ten_chuan():
    # Arrange
    catalog_keys = {"storage", "cooling"}

    # Act
    result = resolve_category("ssd", catalog_keys)

    # Assert
    assert result == "storage"


def test_resolve_category_tra_ve_none_khi_khong_khop():
    # Arrange
    catalog_keys = {"laptop", "mouse"}

    # Act
    result = resolve_category("gpu", catalog_keys)

    # Assert
    assert result is None


# --------------------------------------------------------------------------
# remap_personas_and_rules: trọng số mỗi persona phải chuẩn hoá lại thành 1
# --------------------------------------------------------------------------
def test_trong_so_persona_chuan_hoa_lai_thanh_mot():
    # Arrange: danh mục chỉ có 4 category, đủ để cả 4 persona còn ít nhất 1
    # lựa chọn (không category nào bị mất hết, tránh SystemExit), nhưng với
    # "gamer" thì đây chỉ là một phần nhỏ trong 8 category gốc của nó.
    cats = ["gpu", "cpu", "ssd", "mouse"]
    catalog = {c: [Item(f"{c}-1", c, "mid", c, 1_000_000, 1.0)] for c in cats}

    # Act
    personas, _rules = remap_personas_and_rules(catalog)
    gamer = next(p for p in personas if p.name == "gamer")

    # Assert: trọng số còn lại phải cộng lại đúng bằng 1 (không bị bỏ sót
    # chuẩn hoá), và chỉ còn đúng 4 category có trong danh mục
    assert set(gamer.primary) == set(cats)
    assert sum(gamer.primary.values()) == pytest.approx(1.0)


def test_remap_bao_loi_ro_rang_khi_persona_mat_het_category():
    # Arrange: danh mục không chứa category nào của bất kỳ persona nào
    catalog = {"khong_lien_quan": [Item("x-1", "khong_lien_quan", "mid", "X", 1000, 1.0)]}

    # Act / Assert
    with pytest.raises(SystemExit):
        remap_personas_and_rules(catalog)


# --------------------------------------------------------------------------
# load_real_catalog: kiểm tra hợp đồng, loại bỏ dòng dữ liệu bẩn có lý do rõ ràng
# --------------------------------------------------------------------------
def test_load_real_catalog_loai_bo_dong_khong_hop_le(tmp_path):
    # Arrange
    bad_file = tmp_path / "products.json"
    bad_file.write_text(json.dumps({"products": [
        {"productId": "P1", "name": "Tot", "category": "gpu", "price": 5_000_000, "status": "ACTIVE"},
        {"productId": "P2", "name": "Thieu gia", "category": "gpu", "status": "ACTIVE"},
        {"productId": "P3", "name": "Gia am", "category": "gpu", "price": -1, "status": "ACTIVE"},
        {"productId": "P4", "name": "Het hang", "category": "gpu", "price": 1000, "status": "INACTIVE"},
        {"productId": "", "name": "Thieu id", "category": "gpu", "price": 1000, "status": "ACTIVE"},
    ]}), encoding="utf-8")
    import random

    # Act
    catalog = load_real_catalog(random.Random(0), bad_file)

    # Assert: chỉ còn đúng 1 sản phẩm hợp lệ (P1)
    assert sum(len(items) for items in catalog.values()) == 1
    assert catalog["gpu"][0].item_id == "P1"

# --------------------------------------------------------------------------
# Khớp với web và API: mã sản phẩm, tên sự kiện, định dạng thời gian
# --------------------------------------------------------------------------
def test_mac_dinh_dung_danh_muc_that_nen_ma_san_pham_khop_web(tmp_path):
    # Arrange
    out = tmp_path / "run"
    raw = json.loads(DEFAULT_PRODUCTS.read_text(encoding="utf-8-sig"))
    real_ids = {p["productId"] for p in raw["products"]}

    # Act: không truyền --products
    main(["--out", str(out), "--seed", "42", "--users", "60"])
    product_ids = {r["ITEM_ID"] for r in read_csv(out / "products.csv")}
    event_ids = {r["ITEM_ID"] for r in read_csv(out / "interactions_train.csv")}

    # Assert: mọi mã sản phẩm, kể cả trong sự kiện, đều có trên web
    assert product_ids <= real_ids
    assert event_ids <= real_ids


def test_builtin_dung_danh_muc_tu_che(tmp_path):
    # Arrange
    out = tmp_path / "run"

    # Act
    main(["--out", str(out), "--seed", "42", "--users", "20", "--builtin"])

    # Assert
    assert "gpu-001" in {r["ITEM_ID"] for r in read_csv(out / "products.csv")}


def test_bao_loi_ro_rang_khi_khong_thay_file_danh_muc(tmp_path):
    # Act / Assert
    with pytest.raises(SystemExit):
        main(["--out", str(tmp_path / "run"), "--products", str(tmp_path / "khong-co.json")])


def test_ten_su_kien_viet_hoa_khop_api(tmp_path):
    # Arrange
    out = tmp_path / "run"
    main(["--out", str(out), "--seed", "42", "--users", "80"])

    # Act
    rows = read_csv(out / "interactions_train.csv") + read_csv(out / "interactions_test.csv")
    types = {r["EVENT_TYPE"] for r in rows}

    # Assert: đúng enum eventType của API cộng PURCHASE từ ordering, không còn loại nào khác
    assert types == {"VIEW", "ADD_TO_CART", "PURCHASE"}


def test_moi_cot_thoi_gian_cung_dinh_dang_iso_utc(tmp_path):
    # Arrange
    out = tmp_path / "run"
    main(["--out", str(out), "--seed", "42", "--users", "80"])

    # Act
    values = [r["TIMESTAMP"] for name in ("orders.csv", "cart_items.csv",
                                          "interactions_train.csv", "interactions_test.csv")
              for r in read_csv(out / name)]

    # Assert
    assert values
    assert all(ISO_UTC.match(v) for v in values), "cần dạng 2026-01-01T08:00:00.000Z"


# --------------------------------------------------------------------------
# Người mới: không có lịch sử trong train, dùng để thử gợi ý cho người mới
# --------------------------------------------------------------------------
def test_nguoi_moi_khong_co_su_kien_nao_trong_train(tmp_path):
    # Arrange
    out = tmp_path / "run"
    main(["--out", str(out), "--seed", "42", "--users", "200"])
    new_users = {r["USER_ID"] for r in read_csv(out / "users.csv") if r["IS_NEW"] == "1"}
    assert new_users, "cần có người mới để test này có ý nghĩa"

    # Act
    train_users = {r["USER_ID"] for r in read_csv(out / "interactions_train.csv")}
    test_users = {r["USER_ID"] for r in read_csv(out / "interactions_test.csv")}

    # Assert
    assert not new_users & train_users
    assert new_users <= test_users


def test_tat_nguoi_moi_bang_new_user_frac_0(tmp_path):
    # Arrange
    out = tmp_path / "run"

    # Act
    main(["--out", str(out), "--seed", "42", "--users", "50", "--new-user-frac", "0"])

    # Assert
    assert all(r["IS_NEW"] == "0" for r in read_csv(out / "users.csv"))


# --------------------------------------------------------------------------
# Chạy lệnh trên Windows: thoát mã 0, in tiếng Việt không lỗi
# --------------------------------------------------------------------------
def test_cli_khong_tra_gia_tri_de_thoat_ma_0(tmp_path, monkeypatch):
    # Arrange
    monkeypatch.setattr("sys.argv", ["data", "--out", str(tmp_path / "run"), "--users", "20"])

    # Act
    result = cli()

    # Assert: script của uv thoát với mã khác 0 nếu hàm trả về một giá trị khác None
    assert result is None


def test_in_tieng_viet_khi_console_dung_cp1252(monkeypatch):
    # Arrange: giả lập console Windows dùng cp1252
    raw = io.BytesIO()
    fake = io.TextIOWrapper(raw, encoding="cp1252")
    monkeypatch.setattr("sys.stdout", fake)

    # Act
    use_utf8_output()
    print("Đã ghi file", file=fake)
    fake.flush()

    # Assert
    assert raw.getvalue().decode("utf-8").strip() == "Đã ghi file"
