"""Test cho item-based CF và đánh giá "Dành cho bạn" — viết theo AAA."""
import pytest

from data.evaluate_for_you import evaluate_for_you
from data.evaluate_for_you import main as eval_main
from data.generator.synthetic import main as generate
from data.model.item_cf import build_user_items, item_similarity, recommend_for_user


def test_diem_tuong_tac_lay_trong_so_lon_nhat_khong_cong_don():
    # Arrange: u1 xem gpu 50 lần (spam) và thêm giỏ 1 lần
    events = [("u1", "gpu", "VIEW")] * 50 + [("u1", "gpu", "ADD_TO_CART")]

    # Act
    user_items = build_user_items(events)

    # Assert: điểm là 3 (ADD_TO_CART), không phải 50 + 3
    assert user_items == {"u1": {"gpu": 3.0}}


def test_bo_qua_su_kien_khong_co_trong_so():
    # Arrange
    events = [("u1", "gpu", "REMOVE_FROM_CART"), ("u1", "psu", "view")]

    # Act
    user_items = build_user_items(events)

    # Assert
    assert user_items == {}


def test_cosine_giua_hai_san_pham_tinh_dung():
    # Arrange: a và b cùng được u1, u2 tương tác với cùng điểm; c chỉ có u3
    user_items = {"u1": {"a": 1.0, "b": 1.0}, "u2": {"a": 1.0, "b": 1.0}, "u3": {"c": 1.0}}

    # Act
    sim = item_similarity(user_items)

    # Assert
    assert sim["a"]["b"] == pytest.approx(1.0)
    assert "c" not in sim  # không có người dùng chung với sản phẩm nào khác


def test_goi_y_bo_san_pham_da_tuong_tac_va_xep_theo_diem():
    # Arrange: 3 người mua gpu cũng mua psu; chỉ 2 người mua gpu xem thêm case
    user_items = {
        "u1": {"gpu": 5.0, "psu": 5.0},
        "u2": {"gpu": 5.0, "psu": 5.0, "case": 1.0},
        "u3": {"gpu": 5.0, "psu": 5.0},
        "u4": {"gpu": 5.0, "case": 1.0},
        "moi": {"gpu": 5.0},
    }
    sim = item_similarity(user_items)

    # Act
    recs = recommend_for_user(user_items, sim, "moi", k=10)

    # Assert: cosine(gpu, psu) ≈ 0.77 > cosine(gpu, case) ≈ 0.63
    assert recs == ["psu", "case"]


def test_nguoi_dung_chua_co_lich_su_thi_khong_co_goi_y():
    # Arrange
    user_items = {"u1": {"a": 1.0, "b": 1.0}}
    sim = item_similarity(user_items)

    # Act
    recs = recommend_for_user(user_items, sim, "chua_co", k=10)

    # Assert: API sẽ trả baseline cho trường hợp này (cold-start)
    assert recs == []


def test_danh_gia_for_you_chay_duoc_va_cf_khong_kem_baseline(tmp_path):
    # Arrange
    out = tmp_path / "gen"
    generate(["--out", str(out), "--seed", "42", "--users", "600"])

    # Act
    report = evaluate_for_you(out)

    # Assert: kiểm tra pipeline chạy đúng trên dữ liệu giả lập, không chứng minh mô hình tốt ngoài đời
    s = report["scores"]
    assert report["users_evaluated"] > 0
    assert s["item_cf"]["precision"] >= s["baseline"]["precision"]
    assert s["item_cf"]["coverage"] > s["baseline"]["coverage"]


def test_danh_gia_for_you_cung_du_lieu_cho_cung_ket_qua(tmp_path):
    # Arrange
    out = tmp_path / "gen"
    generate(["--out", str(out), "--seed", "7", "--users", "200"])

    # Act
    first = eval_main(["--data", str(out)])
    second = eval_main(["--data", str(out)])

    # Assert
    assert first == second


def test_cham_rieng_nguoi_moi_bang_baseline(tmp_path):
    # Arrange
    out = tmp_path / "gen"
    generate(["--out", str(out), "--seed", "42", "--users", "300"])

    # Act
    report = evaluate_for_you(out)

    # Assert: có người mới được chấm, và CF không chấm nhóm này
    assert report["new_users_evaluated"] > 0
    assert "baseline_new_users" in report["scores"]
