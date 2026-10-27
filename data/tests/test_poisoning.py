"""Test thí nghiệm đầu độc gợi ý (threat model E2), viết theo AAA."""
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from data.generator import synthetic
from data.model.item_cf import build_user_items
from data.pipeline.sources import Event, synthetic_events
from data.security.poisoning import (
    attack_events,
    build_user_items_sum,
    pick_target,
    run_experiment,
    to_markdown,
)

AT = datetime(2026, 10, 27, tzinfo=UTC)


def test_spam_lap_lai_khong_tang_diem_khi_gop_max():
    # Arrange: 1 người xem cùng sản phẩm 50 lần
    rows = [("u1", "p1", "VIEW")] * 50

    # Act
    kept = build_user_items(rows)
    summed = build_user_items_sum(rows)

    # Assert
    assert kept["u1"]["p1"] == 1.0
    assert summed["u1"]["p1"] == 50.0


def test_ke_tan_cong_chi_gui_duoc_view_va_add_to_cart():
    # Act
    events = attack_events("t1", ["p1", "p2"], accounts=3, repeats=4, at=AT)

    # Assert: API chặn PURCHASE từ client (E1) nên thí nghiệm cũng không có
    assert {e.event_type for e in events} == {"VIEW", "ADD_TO_CART"}
    assert len({e.user for e in events}) == 3
    assert sum(e.product_id == "t1" and e.event_type == "VIEW" for e in events) == 12


def test_muc_tieu_la_hang_it_mua_nhat_moi_la_hang_ban_chay():
    # Arrange
    events = [
        Event("u1", "a", "PURCHASE", AT, "o1"),
        Event("u2", "a", "PURCHASE", AT, "o2"),
        Event("u3", "b", "PURCHASE", AT, "o3"),
    ]

    # Act
    target, decoys = pick_target(events, ["a", "b", "c"])

    # Assert
    assert target == "c"
    assert decoys[:2] == ["a", "b"]


def test_gop_max_chan_spam_lap_lai_va_mua_kem_khong_bi_anh_huong(tmp_path: Path):
    # Arrange: dữ liệu giả lập nhỏ cho test chạy nhanh
    synthetic.main(["--out", str(tmp_path), "--users", "150", "--seed", "7"])
    events = synthetic_events(tmp_path)
    catalog = sorted({e.product_id for e in events})

    # Act
    rows = run_experiment(events, catalog, accounts=(0, 20), repeats=(50,))
    at = {(r.accounts, r.weighting): r for r in rows}

    # Assert: spam lặp lại đẩy mục tiêu lên khi cộng dồn, không lên khi lấy trọng số lớn nhất
    assert at[(20, "sum")].for_you > at[(0, "sum")].for_you
    assert at[(20, "max")].for_you <= at[(0, "max")].for_you + 0.05
    # "Thường mua kèm" chỉ học từ PURCHASE nên không đổi
    assert at[(20, "max")].also_bought == at[(0, "max")].also_bought
    assert "| 20 | 50 |" in to_markdown(rows)
