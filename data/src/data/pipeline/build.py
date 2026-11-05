"""
Tính gợi ý cho mọi anchor trước khi ghi bảng `recs` (recommendation.md mục 2).

- ALSO_BOUGHT: luật mua kèm theo lift; thiếu thì bù bằng hàng bán chạy (cách tốt nhất ở
  `data-eval`: "luật mua kèm, thiếu luật thì dùng baseline").
- FOR_YOU: item-based CF; thiếu thì bù bằng hàng bán chạy. Người chưa có lịch sử không có
  dòng nào, API trả hàng bán chạy (ADR-0016).
"""
from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from data.model.association import Rule
from data.model.item_cf import Similarity, UserItems, scored_for_user
from data.pipeline.recs_table import TOP_K, Rec

ALL = "ALL"
MIN_ORDERS = 5
WINDOWS_DAYS = (30, 90, 365)


@dataclass(frozen=True)
class CatalogItem:
    """Cột đọc từ bảng products (ProjectionExpression: productId, category, status, createdAt)."""

    product_id: str
    category: str
    status: str
    created_at: str


def bestseller_counts(
    purchases: Iterable[tuple[str, datetime]], until: datetime, window_days: int = 30
) -> list[tuple[str, int]]:
    """(sản phẩm, số lần mua) trong [until - window_days, until), nhiều trước, hoà theo mã.
    Cùng cách xếp với data.baseline.bestseller.bestsellers, kèm số đếm để làm điểm."""
    since = until - timedelta(days=window_days)
    counts: Counter[str] = Counter(item for item, ts in purchases if since <= ts < until)
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))


def _fill(recs: list[Rec], ranked: Sequence[tuple[str, int]], exclude: set[str], k: int) -> list[Rec]:
    taken = exclude | {r.item_id for r in recs}
    for item, count in ranked:
        if len(recs) >= k:
            break
        if item not in taken:
            recs.append(Rec(item, float(count), "BESTSELLER"))
            taken.add(item)
    return recs


def also_bought(
    rules: dict[str, list[Rule]],
    catalog: Iterable[str],
    ranked: Sequence[tuple[str, int]],
    k: int = TOP_K,
) -> dict[str, list[Rec]]:
    out: dict[str, list[Rec]] = {}
    for anchor in catalog:
        recs = [Rec(r.consequent, r.lift, "ASSOCIATION_RULE") for r in rules.get(anchor, [])[:k]]
        out[anchor] = _fill(recs, ranked, {anchor}, k)
    return out


def for_you(
    user_items: UserItems,
    sim: Similarity,
    ranked: Sequence[tuple[str, int]],
    k: int = TOP_K,
) -> dict[str, list[Rec]]:
    out: dict[str, list[Rec]] = {}
    for user, seen in user_items.items():
        recs = [Rec(item, score, "ITEM_CF") for item, score in scored_for_user(user_items, sim, user, k)]
        out[user] = _fill(recs, ranked, set(seen), k)
    return out


def bestsellers(
    purchases: Sequence[tuple[str, str, datetime]],
    catalog: Sequence[CatalogItem],
    until: datetime,
    k: int = TOP_K,
) -> tuple[str, dict[str, list[Rec]]]:
    """Hàng bán chạy cho anchor `ALL` và từng category, kèm `basis` ghi lên con trỏ.

    `purchases` là (orderId, productId, thời điểm). Cửa sổ ngắn nhất trong 30, 90, 365 ngày có
    ít nhất 5 đơn thì dùng cửa sổ đó (`PURCHASES_<n>D`); không cửa sổ nào đủ thì xếp theo hàng mới
    nhất (`NEWEST`). Mỗi anchor bù thêm hàng mới nhất cùng loại cho đủ `k` dòng. Chỉ hàng ACTIVE.
    """
    active = [c for c in catalog if c.status == "ACTIVE"]
    active_ids = {c.product_id for c in active}
    newest = sorted(active, key=lambda c: (c.created_at, c.product_id), reverse=True)

    basis, counts = "NEWEST", Counter[str]()
    for days in WINDOWS_DAYS:
        since = until - timedelta(days=days)
        window = [(o, p) for o, p, ts in purchases if since <= ts < until and p in active_ids]
        if len({o for o, _ in window}) >= MIN_ORDERS:
            basis, counts = f"PURCHASES_{days}D", Counter(p for _, p in window)
            break

    def ranked(items: Sequence[CatalogItem]) -> list[Rec]:
        ids = {c.product_id for c in items}
        sold = sorted(((p, n) for p, n in counts.items() if p in ids), key=lambda kv: (-kv[1], kv[0]))
        recs = [Rec(p, float(n), "BESTSELLER") for p, n in sold[:k]]
        taken = {r.item_id for r in recs}
        for c in (c for c in newest if c.product_id in ids):
            if len(recs) >= k:
                break
            if c.product_id not in taken:
                recs.append(Rec(c.product_id, 0.0, "BESTSELLER"))
        return recs

    out = {ALL: ranked(active)}
    for category in sorted({c.category for c in active}):
        out[category] = ranked([c for c in active if c.category == category])
    return basis, out
