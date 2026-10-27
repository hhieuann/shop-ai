"""Test phần đọc, ghi DynamoDB và lần chạy đầy đủ của job đêm, bằng bảng giả trong bộ nhớ (AAA)."""
from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Self

from data.generator.synthetic import DEFAULT_PRODUCTS
from data.pipeline.build import CatalogItem
from data.pipeline.dynamo import (
    PRODUCT_PROJECTION,
    DynamoRecsStore,
    scan_all,
    to_dynamo,
)
from data.pipeline.job import gate_also_bought, run_job
from data.pipeline.lambda_handler import run
from data.pipeline.sources import Event, Skipped, catalog_from_items, events_from_items

NOW = datetime(2026, 10, 27, 19, 0, tzinfo=UTC)


class FakeTable:
    """Đủ các lời gọi boto3 Table mà adapter dùng; Scan trả từng trang `page_size` dòng."""

    def __init__(self, items: list[dict[str, Any]] | None = None, page_size: int = 2) -> None:
        self.items: dict[tuple[str, str], dict[str, Any]] = {}
        self.rows = list(items or [])
        self.page_size = page_size
        self.scans: list[dict[str, Any]] = []

    # --- Scan, cho products và events
    def scan(self, **kwargs: Any) -> Mapping[str, Any]:
        self.scans.append(kwargs)
        start = int(kwargs.get("ExclusiveStartKey", {"i": 0})["i"])
        page = self.rows[start : start + self.page_size]
        out: dict[str, Any] = {"Items": page}
        if start + self.page_size < len(self.rows):
            out["LastEvaluatedKey"] = {"i": start + self.page_size}
        return out

    # --- recs
    def batch_writer(self) -> FakeTable:
        return self

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def put_item(self, *, Item: Mapping[str, Any]) -> None:
        self.items[(Item["pk"], Item["sk"])] = dict(Item)

    def get_item(self, **kwargs: Any) -> Mapping[str, Any]:
        key = kwargs["Key"]
        item = self.items.get((key["pk"], key["sk"]))
        return {} if item is None else {"Item": item}

    def query(self, **kwargs: Any) -> Mapping[str, Any]:
        values = kwargs["ExpressionAttributeValues"]
        rows = [
            {"pk": pk, "sk": sk}
            for (pk, sk) in sorted(self.items)
            if pk == values[":pk"] and sk.startswith(values[":v"])
        ]
        return {"Items": rows}

    def update_item(self, **kwargs: Any) -> Mapping[str, Any]:
        key = kwargs["Key"]
        self.items[(key["pk"], key["sk"])]["ttl"] = kwargs["ExpressionAttributeValues"][":ttl"]
        return {}


def iso(ts: datetime) -> str:
    return ts.isoformat().replace("+00:00", "Z")


CATALOG = [
    CatalogItem("g1", "gpu", "ACTIVE", "2026-01-01T00:00:00.000Z"),
    CatalogItem("p1", "psu", "ACTIVE", "2026-01-02T00:00:00.000Z"),
    CatalogItem("c1", "cooling", "ACTIVE", "2026-01-03T00:00:00.000Z"),
    CatalogItem("x1", "gpu", "INACTIVE", "2026-01-04T00:00:00.000Z"),
]


def gpu_psu_orders(n: int, start: datetime, prefix: str) -> list[Event]:
    """n đơn, mỗi đơn có g1 + p1 (quy luật mua kèm), người mua khác nhau."""
    out: list[Event] = []
    for i in range(n):
        ts = start + timedelta(hours=i)
        for product in ("g1", "p1"):
            out.append(Event(f"{prefix}{i}", product, "PURCHASE", ts, f"{prefix}o{i}"))
    return out


# --------------------------------------------------------------------------
# Đọc bảng
# --------------------------------------------------------------------------
def test_scan_doc_het_cac_trang():
    # Arrange
    table = FakeTable([{"n": i} for i in range(5)], page_size=2)

    # Act
    rows = list(scan_all(table, **PRODUCT_PROJECTION))

    # Assert
    assert [r["n"] for r in rows] == [0, 1, 2, 3, 4]
    assert len(table.scans) == 3
    assert table.scans[0]["ProjectionExpression"] == "productId, category, #s, createdAt"


def test_doc_su_kien_bo_dong_hong_va_purchase_thieu_order():
    # Arrange
    ts = iso(NOW - timedelta(days=1))
    items: list[dict[str, Any]] = [
        {"userIdHash": "h1", "productId": "g1", "eventType": "VIEW", "timestamp": ts},
        {"userIdHash": "h1", "productId": "g1", "eventType": "PURCHASE", "timestamp": ts, "orderId": "o1"},
        {"userIdHash": "h1", "productId": "g1", "eventType": "PURCHASE", "timestamp": ts},
        {"userIdHash": "h1", "productId": "g1", "eventType": "CLICK", "timestamp": ts},
        {"userIdHash": "h1", "productId": "g1", "eventType": "VIEW", "timestamp": "hôm qua"},
        {"productId": "g1", "eventType": "VIEW", "timestamp": ts},
    ]
    skipped = Skipped()

    # Act
    events = events_from_items(items, skipped)

    # Assert
    assert [(e.event_type, e.order_id) for e in events] == [("VIEW", None), ("PURCHASE", "o1")]
    assert events[0].ts == NOW - timedelta(days=1)
    assert skipped.events == 4


def test_doc_san_pham_viet_thuong_category_va_bo_dong_thieu_cot():
    # Arrange
    skipped = Skipped()

    # Act
    catalog = catalog_from_items(
        [
            {"productId": "g1", "category": "GPU", "status": "ACTIVE", "createdAt": "2026-01-01"},
            {"productId": "p1", "status": "ACTIVE"},
        ],
        skipped,
    )

    # Assert
    assert catalog == [CatalogItem("g1", "gpu", "ACTIVE", "2026-01-01")]
    assert skipped.products == 1


# --------------------------------------------------------------------------
# Ghi bảng recs
# --------------------------------------------------------------------------
def test_ghi_doi_float_sang_decimal_va_doc_lai_con_tro():
    # Arrange
    table = FakeTable()
    store = DynamoRecsStore(table)

    # Act
    store.put_items([
        {"pk": "ALSO_BOUGHT#g1", "sk": "20261027#01", "score": 1.23456789, "ttl": 5},
        {"pk": "META", "sk": "ACTIVE#ALSO_BOUGHT", "activeVersion": 20261027},
    ])

    # Assert
    assert table.items[("ALSO_BOUGHT#g1", "20261027#01")]["score"] == Decimal("1.234568")
    assert store.active_version("ALSO_BOUGHT") == 20261027
    assert store.active_version("FOR_YOU") is None
    assert to_dynamo(3) == 3


def test_gia_han_ttl_chi_dong_cua_phien_ban_va_anchor_duoc_hoi():
    # Arrange
    table = FakeTable()
    store = DynamoRecsStore(table)
    store.put_items([
        {"pk": "ALSO_BOUGHT#g1", "sk": "1#01", "ttl": 1},
        {"pk": "ALSO_BOUGHT#g1", "sk": "2#01", "ttl": 1},
        {"pk": "ALSO_BOUGHT#p1", "sk": "1#01", "ttl": 1},
    ])

    # Act
    n = store.extend_ttl("ALSO_BOUGHT", 1, 99, ["g1"])

    # Assert
    assert n == 1
    assert table.items[("ALSO_BOUGHT#g1", "1#01")]["ttl"] == 99
    assert table.items[("ALSO_BOUGHT#g1", "2#01")]["ttl"] == 1
    assert table.items[("ALSO_BOUGHT#p1", "1#01")]["ttl"] == 1


# --------------------------------------------------------------------------
# Một lần chạy đầy đủ
# --------------------------------------------------------------------------
def test_mo_hinh_mua_kem_thang_baseline_khi_co_quy_luat():
    # Arrange: trước mốc có quy luật g1 + p1; 12 món khác bán lẻ nhiều hơn nên top 10 bán chạy
    # không có p1. Sau mốc, khách vẫn mua g1 + p1.
    cutoff = NOW - timedelta(days=30)
    fillers = [f"f{n:02d}" for n in range(12)]
    purchases = gpu_psu_orders(6, cutoff - timedelta(days=10), "a")
    purchases += [
        Event(f"u{f}{i}", f, "PURCHASE", cutoff - timedelta(days=5), f"o{f}{i}")
        for f in fillers for i in range(8)
    ]
    purchases += gpu_psu_orders(3, cutoff + timedelta(days=1), "b")

    # Act
    gate = gate_also_bought(purchases, {"g1", "p1", *fillers}, cutoff)

    # Assert
    assert gate.model.precision > gate.baseline.precision


def test_chay_du_ba_loai_goi_y_va_bat_con_tro():
    # Arrange
    events = gpu_psu_orders(6, NOW - timedelta(days=60), "a") + gpu_psu_orders(3, NOW - timedelta(days=5), "b")
    events.append(Event("a0", "c1", "VIEW", NOW - timedelta(days=59)))
    table = FakeTable()

    # Act
    results, _ = run_job(DynamoRecsStore(table), events, CATALOG, NOW)

    # Assert
    assert [(r.rec_type, r.activated) for r in results] == [
        ("ALSO_BOUGHT", True),
        ("FOR_YOU", True),
        ("BESTSELLER", True),
    ]
    pointer = table.items[("META", "ACTIVE#BESTSELLER")]
    assert pointer["basis"] == "PURCHASES_90D"  # 30 ngày gần nhất mới có 3 đơn
    assert table.items[("ALSO_BOUGHT#g1", "20261027#01")]["productId"] == "p1"
    # Hàng INACTIVE không phải anchor và không được bù vào
    assert ("ALSO_BOUGHT#x1", "20261027#01") not in table.items
    assert all(row.get("productId") != "x1" for row in table.items.values())


def test_lambda_tron_du_lieu_gia_lap_va_khong_log_ma_nguoi_dung(tmp_path: Path):
    # Arrange: bảng products có đúng các sản phẩm thật trong file seed
    seed = json.loads(DEFAULT_PRODUCTS.read_text(encoding="utf-8-sig"))["products"]
    products = FakeTable(
        [{"productId": p["productId"], "category": p["category"], "status": "ACTIVE",
          "createdAt": "2026-10-01T00:00:00.000Z"} for p in seed],
        page_size=50,
    )
    events = FakeTable([
        {"userIdHash": "hash-that", "productId": seed[0]["productId"], "eventType": "VIEW",
         "timestamp": iso(NOW - timedelta(days=1))},
    ])
    recs = FakeTable()

    # Act
    summary = run(recs, products, events, NOW, DEFAULT_PRODUCTS)

    # Assert
    assert summary["realEvents"] == 1
    assert summary["syntheticEvents"] > 1000
    assert [r["activated"] for r in summary["results"]][2] is True
    assert recs.items[("META", "ACTIVE#BESTSELLER")]["basis"] == "PURCHASES_30D"
    # FOR_YOU chỉ ghi cho người dùng thật, không ghi cho người dùng giả lập
    for_you_pks = {pk for pk, _ in recs.items if pk.startswith("FOR_YOU#")}
    assert for_you_pks <= {"FOR_YOU#hash-that"}
    text = json.dumps(summary)
    assert "hash-that" not in text
    assert '"u0' not in text


def test_lambda_chi_in_mot_dong_json(tmp_path: Path, capsys, monkeypatch):
    # Arrange: thay boto3 bằng bảng giả, chạy chế độ giả lập như dev
    import sys
    import types

    seed = json.loads(DEFAULT_PRODUCTS.read_text(encoding="utf-8-sig"))["products"]
    tables = {
        "recs": FakeTable(),
        "products": FakeTable(
            [{"productId": p["productId"], "category": p["category"], "status": "ACTIVE",
              "createdAt": "2026-10-01T00:00:00.000Z"} for p in seed],
            page_size=50,
        ),
        "events": FakeTable([]),
    }
    fake_boto3 = types.SimpleNamespace(
        resource=lambda _name: types.SimpleNamespace(Table=lambda name: tables[name])
    )
    monkeypatch.setitem(sys.modules, "boto3", fake_boto3)
    for key, value in {"RECS_TABLE": "recs", "PRODUCTS_TABLE": "products", "EVENTS_TABLE": "events",
                       "SYNTHETIC": "1", "PRODUCTS_JSON": str(DEFAULT_PRODUCTS)}.items():
        monkeypatch.setenv(key, value)
    from data.pipeline.lambda_handler import handler

    # Act
    handler({}, None)
    out = capsys.readouterr()

    # Assert: đúng 1 dòng, là JSON, không có gì ở stderr
    lines = out.out.strip().splitlines()
    assert len(lines) == 1
    line = json.loads(lines[0])
    assert line["message"] == "Job gợi ý mỗi đêm xong"
    assert line["syntheticEvents"] > 1000
    assert out.err == ""
