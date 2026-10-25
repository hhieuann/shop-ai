"""
Dữ liệu đầu vào của job đêm, đọc về một dạng chung trước khi tính gợi ý.

- Sự kiện thật: các dòng bảng `events` (dynamodb-design.md, bảng events). Chỉ có `userIdHash`,
  không có `userId` thật; `PURCHASE` có thêm `orderId` để gom món theo đơn.
- Sản phẩm: các dòng bảng `products`, chỉ 4 cột đọc được (ADR-0017): productId, category, status, createdAt.
- Dữ liệu giả lập (chỉ dev, staging): file CSV của `data.generator.synthetic`, đổi sang cùng dạng.

Dòng hỏng (thiếu cột, sai loại, sai giờ) thì bỏ qua và đếm, không làm hỏng cả lần chạy.
"""
from __future__ import annotations

import csv
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from data.pipeline.build import CatalogItem

EVENT_TYPES = frozenset({"VIEW", "ADD_TO_CART", "PURCHASE"})


@dataclass(frozen=True)
class Event:
    user: str
    product_id: str
    event_type: str
    ts: datetime
    order_id: str | None = None


@dataclass
class Skipped:
    """Số dòng bỏ qua theo nguồn, để ghi vào log của lần chạy."""

    events: int = 0
    products: int = 0


def _parse_ts(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        ts = datetime.fromisoformat(value)
    except ValueError:
        return None
    return ts if ts.tzinfo is not None else None


def _text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def events_from_items(items: Iterable[Mapping[str, object]], skipped: Skipped) -> list[Event]:
    """Dòng bảng events → Event. PURCHASE thiếu orderId thì bỏ (không gom được vào đơn)."""
    out: list[Event] = []
    for item in items:
        user, product, kind = _text(item.get("userIdHash")), _text(item.get("productId")), item.get("eventType")
        ts, order = _parse_ts(item.get("timestamp")), _text(item.get("orderId"))
        if user is None or product is None or ts is None or kind not in EVENT_TYPES:
            skipped.events += 1
            continue
        if kind == "PURCHASE" and order is None:
            skipped.events += 1
            continue
        out.append(Event(user, product, str(kind), ts, order if kind == "PURCHASE" else None))
    return out


def catalog_from_items(items: Iterable[Mapping[str, object]], skipped: Skipped) -> list[CatalogItem]:
    out: list[CatalogItem] = []
    for item in items:
        pid, cat, status = _text(item.get("productId")), _text(item.get("category")), _text(item.get("status"))
        if pid is None or cat is None or status is None:
            skipped.products += 1
            continue
        out.append(CatalogItem(pid, cat.lower(), status, _text(item.get("createdAt")) or ""))
    return out


def synthetic_events(data_dir: Path) -> list[Event]:
    """CSV của generator → Event. VIEW, ADD_TO_CART lấy từ interactions; PURCHASE lấy từ đơn
    `confirmed` và món trong đơn để có orderId (interactions không ghi orderId)."""

    def rows(name: str) -> list[dict[str, str]]:
        with (data_dir / name).open(encoding="utf-8") as f:
            return list(csv.DictReader(f))

    out: list[Event] = []
    for name in ("interactions_train.csv", "interactions_test.csv"):
        for r in rows(name):
            if r["EVENT_TYPE"] in ("VIEW", "ADD_TO_CART"):
                out.append(Event(r["USER_ID"], r["ITEM_ID"], r["EVENT_TYPE"],
                                 datetime.fromisoformat(r["TIMESTAMP"])))

    orders = {r["ORDER_ID"]: r for r in rows("orders.csv") if r["STATUS"] == "confirmed"}
    for r in rows("order_items.csv"):
        order = orders.get(r["ORDER_ID"])
        if order is not None:
            out.append(Event(order["USER_ID"], r["ITEM_ID"], "PURCHASE",
                             datetime.fromisoformat(order["TIMESTAMP"]), r["ORDER_ID"]))
    return out
