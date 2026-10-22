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
from datetime import datetime, timedelta

from data.model.association import Rule
from data.model.item_cf import Similarity, UserItems, scored_for_user
from data.pipeline.recs_table import TOP_K, Rec


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
