"""Test cho luật mua kèm, baseline bán chạy và đánh giá offline — viết theo AAA."""
from datetime import UTC, datetime, timedelta

import pytest

from data.baseline.bestseller import bestsellers, top_k_excluding
from data.evaluate import evaluate, score
from data.evaluate import main as eval_main
from data.generator.synthetic import main as generate
from data.model.association import mine_rules, top_k


# --------------------------------------------------------------------------
# Luật mua kèm: support, confidence, lift tính đúng theo định nghĩa
# --------------------------------------------------------------------------
def test_luat_mua_kem_tinh_dung_support_confidence_lift():
    # Arrange: 4 đơn; gpu nằm trong 2 đơn, cả 2 đều có psu; psu nằm trong 3 đơn
    baskets = [{"gpu", "psu"}, {"gpu", "psu"}, {"psu"}, {"mouse"}]

    # Act
    rules = mine_rules(baskets, min_pair_count=1, min_confidence=0.0)

    # Assert
    rule = rules["gpu"][0]
    assert rule.consequent == "psu"
    assert rule.pair_count == 2
    assert rule.support == pytest.approx(2 / 4)
    assert rule.confidence == pytest.approx(2 / 2)
    assert rule.lift == pytest.approx(1.0 / (3 / 4))


def test_luat_mua_kem_xep_theo_lift_cao_truoc():
    # Arrange: a đi với b (b hiếm) và với c (c phổ biến), cùng số lần
    baskets = [{"a", "b"}, {"a", "b"}, {"a", "c"}, {"a", "c"}, {"c"}, {"c"}, {"c"}]

    # Act
    rules = mine_rules(baskets, min_pair_count=1, min_confidence=0.0)

    # Assert: b hiếm hơn c nên lift(a→b) cao hơn, đứng trước
    assert top_k(rules, "a") == ["b", "c"]


def test_luat_mua_kem_bo_cap_duoi_nguong():
    # Arrange: cặp (x, y) chỉ xuất hiện 1 lần
    baskets = [{"x", "y"}, {"x"}, {"y"}]

    # Act
    rules = mine_rules(baskets, min_pair_count=2, min_confidence=0.0)

    # Assert
    assert top_k(rules, "x") == []


def test_san_pham_trung_trong_mot_don_chi_dem_mot_lan():
    # Arrange: một đơn liệt kê gpu hai lần
    baskets = [["gpu", "gpu", "psu"], ["gpu", "psu"]]

    # Act
    rules = mine_rules(baskets, min_pair_count=1, min_confidence=0.0)

    # Assert
    assert rules["gpu"][0].pair_count == 2
    assert rules["gpu"][0].confidence == pytest.approx(1.0)


# --------------------------------------------------------------------------
# Baseline: chỉ đếm trong cửa sổ N ngày trước mốc cắt, không nhìn tương lai
# --------------------------------------------------------------------------
def test_baseline_chi_dem_trong_cua_so_va_truoc_moc_cat():
    # Arrange
    until = datetime(2026, 7, 1, tzinfo=UTC)
    purchases = [
        ("cu", until - timedelta(days=40)),  # ngoài cửa sổ 30 ngày
        ("cu", until - timedelta(days=40)),
        ("moi", until - timedelta(days=5)),
        ("tuong_lai", until + timedelta(days=1)),  # sau mốc cắt, không được đếm
        ("tuong_lai", until + timedelta(days=1)),
    ]

    # Act
    ranked = bestsellers(purchases, until, window_days=30)

    # Assert
    assert ranked == ["moi"]


def test_baseline_bo_chinh_san_pham_dang_xem():
    # Arrange
    ranked = ["a", "b", "c"]

    # Act
    recs = top_k_excluding(ranked, "b", k=2)

    # Assert
    assert recs == ["a", "c"]


# --------------------------------------------------------------------------
# Chỉ số: precision@k, hit rate@k, coverage
# --------------------------------------------------------------------------
def test_score_tinh_precision_hit_rate_coverage():
    # Arrange: 2 lượt hỏi, k = 2; lượt đầu trúng 1, lượt sau không trúng
    def recommend(anchor: str) -> list[str]:
        return {"a": ["b", "x"], "c": ["x", "y"]}.get(anchor, [])

    queries = [("a", frozenset({"b"})), ("c", frozenset({"d"}))]
    catalog = ["a", "b", "c", "d", "x", "y"]

    # Act
    s = score(recommend, queries, catalog, k=2)

    # Assert
    assert s.precision == pytest.approx(1 / (2 * 2))
    assert s.hit_rate == pytest.approx(1 / 2)
    assert s.coverage == pytest.approx(3 / 6)  # b, x, y


# --------------------------------------------------------------------------
# Đánh giá đầu cuối trên dữ liệu giả lập
# --------------------------------------------------------------------------
def test_danh_gia_chay_duoc_va_luat_mua_kem_khong_kem_baseline(tmp_path):
    # Arrange
    out = tmp_path / "gen"
    generate(["--out", str(out), "--seed", "42", "--users", "600"])

    # Act
    report = evaluate(out)

    # Assert: dữ liệu giả lập có cài sẵn quy luật mua kèm nên luật phải bắt được.
    # Đây là kiểm tra pipeline chạy đúng, không chứng minh mô hình tốt ngoài đời.
    s = report["scores"]
    assert report["queries"] > 0
    assert s["luat_mua_kem_va_baseline"]["precision"] >= s["baseline"]["precision"]
    assert s["luat_mua_kem_va_baseline"]["coverage"] > s["baseline"]["coverage"]


def test_danh_gia_cung_du_lieu_cho_cung_ket_qua(tmp_path):
    # Arrange
    out = tmp_path / "gen"
    generate(["--out", str(out), "--seed", "7", "--users", "200"])

    # Act
    first = eval_main(["--data", str(out)])
    second = eval_main(["--data", str(out)])

    # Assert
    assert first == second


def test_danh_gia_bao_loi_khi_thieu_du_lieu_test(tmp_path):
    # Arrange: chỉ có đơn train
    (tmp_path / "orders.csv").write_text(
        "ORDER_ID,USER_ID,TIMESTAMP,STATUS,SPLIT,N_ITEMS,IS_NOISE,FROM_CART\n"
        "o1,u1,2026-01-01T00:00:00.000Z,confirmed,train,2,0,0\n",
        encoding="utf-8",
    )
    (tmp_path / "order_items.csv").write_text(
        "ORDER_ID,ITEM_ID,UNIT_PRICE_VND\no1,a,1\no1,b,1\n", encoding="utf-8"
    )
    (tmp_path / "products.csv").write_text(
        "ITEM_ID,CATEGORY,TIER,NAME,PRICE_VND\na,x,low,A,1\nb,x,low,B,1\n", encoding="utf-8"
    )

    # Act + Assert
    with pytest.raises(ValueError):
        evaluate(tmp_path)
