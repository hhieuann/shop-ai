"""Test cho pipeline gợi ý mỗi đêm — viết theo AAA (Arrange, Act, Assert)."""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta

from data.evaluate import Scores
from data.model.association import mine_rules
from data.model.item_cf import build_user_items, item_similarity
from data.pipeline.build import also_bought, bestseller_counts, for_you
from data.pipeline.nightly import run_nightly
from data.pipeline.recs_table import Rec, RecType, pointer_item, row_items, version_for

NOW = datetime(2026, 10, 22, 17, 0, tzinfo=UTC)
GOOD = Scores(precision=0.05, hit_rate=0.4, coverage=0.6)
BASE = Scores(precision=0.03, hit_rate=0.2, coverage=0.1)
BAD = Scores(precision=0.01, hit_rate=0.1, coverage=0.6)


class MemoryStore:
    """Bảng recs giả trong bộ nhớ, khoá (pk, sk) như DynamoDB."""

    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict[str, object]] = {}

    def put_items(self, items: Sequence[Mapping[str, object]]) -> None:
        for item in items:
            self.items[(str(item["pk"]), str(item["sk"]))] = dict(item)

    def active_version(self, rec_type: RecType) -> int | None:
        pointer = self.items.get(("META", f"ACTIVE#{rec_type}"))
        return None if pointer is None else int(str(pointer["activeVersion"]))

    def extend_ttl(self, rec_type: RecType, version: int, ttl: int) -> int:
        rows = [
            v for (pk, sk), v in self.items.items()
            if pk.startswith(f"{rec_type}#") and sk.startswith(f"{version}#")
        ]
        for row in rows:
            row["ttl"] = ttl
        return len(rows)

    def rows(self, version: int) -> list[dict[str, object]]:
        return [v for (pk, sk), v in self.items.items() if pk != "META" and sk.startswith(f"{version}#")]


RECS = {"P1": [Rec("P2", 3.0, "ASSOCIATION_RULE"), Rec("P3", 2.0, "BESTSELLER")]}


# --------------------------------------------------------------------------
# Khoá bảng recs đúng dynamodb-design.md
# --------------------------------------------------------------------------
def test_dong_goi_y_co_khoa_rank_dem_hai_chu_so_va_ttl_7_ngay():
    # Act
    rows = row_items("ALSO_BOUGHT", 20261022, RECS, NOW)

    # Assert
    assert [(r["pk"], r["sk"], r["itemId"]) for r in rows] == [
        ("ALSO_BOUGHT#P1", "20261022#01", "P2"),
        ("ALSO_BOUGHT#P1", "20261022#02", "P3"),
    ]
    assert rows[0]["ttl"] == int((NOW + timedelta(days=7)).timestamp())
    assert rows[0]["generatedAt"] == "2026-10-22T17:00:00.000Z"


def test_chi_giu_toi_da_10_goi_y_moi_anchor():
    # Arrange
    many = {"P1": [Rec(f"X{i}", 1.0, "BESTSELLER") for i in range(15)]}

    # Act
    rows = row_items("ALSO_BOUGHT", 1, many, NOW)

    # Assert
    assert [r["sk"] for r in rows][-1] == "1#10"
    assert len(rows) == 10


def test_con_tro_khong_co_ttl():
    # Act
    item = pointer_item("FOR_YOU", 20261022, NOW)

    # Assert
    assert item == {
        "pk": "META", "sk": "ACTIVE#FOR_YOU", "activeVersion": 20261022,
        "updatedAt": "2026-10-22T17:00:00.000Z",
    }


def test_phien_ban_theo_ngay_utc():
    # 23:30 giờ Việt Nam ngày 22/10 vẫn là 16:30 UTC ngày 22/10
    assert version_for(datetime(2026, 10, 22, 16, 30, tzinfo=UTC)) == 20261022


# --------------------------------------------------------------------------
# Vòng đời một lần chạy (recommendation.md mục 3)
# --------------------------------------------------------------------------
def test_bat_phien_ban_moi_khi_khong_kem_baseline():
    # Arrange
    store = MemoryStore()

    # Act
    result = run_nightly(store, "ALSO_BOUGHT", RECS, GOOD, BASE, NOW)

    # Assert
    assert result.activated
    assert store.active_version("ALSO_BOUGHT") == 20261022


def test_giu_phien_ban_cu_va_gia_han_ttl_khi_kem_baseline():
    # Arrange: hôm trước đã bật phiên bản 20261021
    store = MemoryStore()
    yesterday = NOW - timedelta(days=1)
    run_nightly(store, "ALSO_BOUGHT", RECS, GOOD, BASE, yesterday)

    # Act: hôm nay precision kém baseline
    result = run_nightly(store, "ALSO_BOUGHT", RECS, BAD, BASE, NOW)

    # Assert: con trỏ vẫn ở hôm qua, dòng của hôm qua được gia hạn tới hôm nay + 7 ngày
    assert not result.activated
    assert store.active_version("ALSO_BOUGHT") == 20261021
    assert {r["ttl"] for r in store.rows(20261021)} == {int((NOW + timedelta(days=7)).timestamp())}


def test_chay_lai_trong_ngay_khong_nhan_doi_du_lieu():
    # Arrange
    store = MemoryStore()

    # Act
    run_nightly(store, "ALSO_BOUGHT", RECS, GOOD, BASE, NOW)
    run_nightly(store, "ALSO_BOUGHT", RECS, GOOD, BASE, NOW + timedelta(hours=1))

    # Assert: 2 dòng gợi ý + 1 con trỏ, không thêm
    assert len(store.items) == 3


def test_hai_loai_goi_y_co_con_tro_rieng():
    # Arrange
    store = MemoryStore()

    # Act
    run_nightly(store, "ALSO_BOUGHT", RECS, GOOD, BASE, NOW)
    run_nightly(store, "FOR_YOU", {"u1": [Rec("P2", 1.0, "ITEM_CF")]}, BAD, BASE, NOW)

    # Assert
    assert store.active_version("ALSO_BOUGHT") == 20261022
    assert store.active_version("FOR_YOU") is None


# --------------------------------------------------------------------------
# Tính gợi ý: mô hình trước, thiếu thì bù hàng bán chạy
# --------------------------------------------------------------------------
def test_mua_kem_dung_luat_truoc_roi_bu_hang_ban_chay_khong_lap():
    # Arrange
    baskets = [{"gpu", "psu"}, {"gpu", "psu"}, {"ram"}]
    purchases = [(i, NOW - timedelta(days=1)) for b in baskets for i in b]
    ranked = bestseller_counts(purchases, NOW)

    # Act
    recs = also_bought(mine_rules(baskets), ["gpu", "ram"], ranked, k=3)

    # Assert
    assert [(r.item_id, r.source) for r in recs["gpu"]] == [
        ("psu", "ASSOCIATION_RULE"), ("ram", "BESTSELLER"),
    ]
    assert [r.item_id for r in recs["ram"]] == ["gpu", "psu"]


def test_danh_cho_ban_dung_cf_va_bo_mon_da_tuong_tac():
    # Arrange: u1 xem a; u2 xem a và b → gợi ý b cho u1
    user_items = build_user_items(
        [("u1", "a", "VIEW"), ("u2", "a", "VIEW"), ("u2", "b", "PURCHASE")]
    )
    ranked = [("a", 5), ("c", 2)]

    # Act
    recs = for_you(user_items, item_similarity(user_items), ranked, k=3)

    # Assert: b từ CF, c bù từ bán chạy, không gợi ý lại a
    assert [(r.item_id, r.source) for r in recs["u1"]] == [("b", "ITEM_CF"), ("c", "BESTSELLER")]
