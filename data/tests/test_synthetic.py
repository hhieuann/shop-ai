"""Test cho data.generator.synthetic — viết theo AAA (Arrange, Act, Assert)."""
import csv
import json
from pathlib import Path

import pytest

from data.generator.synthetic import (
    Item,
    load_real_catalog,
    main,
    remap_personas_and_rules,
    resolve_category,
)


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
    max_train_ts = max(int(r["TIMESTAMP"]) for r in train)
    min_test_ts = min(int(r["TIMESTAMP"]) for r in test)

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
    n_purchase = sum(1 for e in purchase_events if e["EVENT_TYPE"] == "purchase")
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