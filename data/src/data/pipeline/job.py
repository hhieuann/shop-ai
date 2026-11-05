"""
Toàn bộ một lần chạy job đêm, không gọi AWS (recommendation.md mục 3):

1. Chấm phiên bản mới so với baseline trên dữ liệu chia theo thời gian: học từ sự kiện trước
   mốc `now - TEST_DAYS`, chấm trên sự kiện sau mốc. Cách tính giống `data-eval` và
   `data-eval-for-you`, nhưng mô hình được chấm là đúng hàm ghi vào bảng (luật hoặc CF, thiếu thì
   bù hàng bán chạy).
2. Học lại trên toàn bộ sự kiện tới `now`, ghi ALSO_BOUGHT, FOR_YOU qua `run_nightly` (kém baseline
   thì không bật) và BESTSELLER qua `run_bestsellers` (luôn bật).

Chưa đủ dữ liệu để chấm (chưa có đơn hoặc người dùng nào ở phần test) thì cả hai bên đều 0, nên
phiên bản mới vẫn được bật: nó cũng chỉ là luật có được cộng hàng bán chạy, không tệ hơn baseline.
"""
from __future__ import annotations

from collections.abc import Callable, Collection, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from data.evaluate import Scores, score
from data.model.association import mine_rules
from data.model.item_cf import build_user_items, item_similarity
from data.pipeline.build import (
    CatalogItem,
    also_bought,
    bestseller_counts,
    bestsellers,
    for_you,
)
from data.pipeline.nightly import RecsStore, RunResult, run_bestsellers, run_nightly
from data.pipeline.sources import Event

K = 10
TEST_DAYS = 30
BESTSELLER_WINDOW_DAYS = 30


@dataclass(frozen=True)
class Gate:
    model: Scores
    baseline: Scores


def _baskets(purchases: Sequence[Event]) -> dict[str, tuple[datetime, frozenset[str]]]:
    """orderId → (thời điểm, các sản phẩm trong đơn)."""
    items: dict[str, set[str]] = {}
    when: dict[str, datetime] = {}
    for e in purchases:
        assert e.order_id is not None
        items.setdefault(e.order_id, set()).add(e.product_id)
        when[e.order_id] = min(when.get(e.order_id, e.ts), e.ts)
    return {o: (when[o], frozenset(i)) for o, i in items.items()}


def _ranked(purchases: Sequence[Event], until: datetime, active: set[str]) -> list[tuple[str, int]]:
    pairs = ((e.product_id, e.ts) for e in purchases if e.product_id in active)
    return bestseller_counts(pairs, until, BESTSELLER_WINDOW_DAYS)


def gate_also_bought(purchases: Sequence[Event], active: set[str], cutoff: datetime) -> Gate:
    orders = _baskets(purchases)
    train = [items for ts, items in orders.values() if ts < cutoff]
    test = [items for ts, items in orders.values() if ts >= cutoff]
    ranked = _ranked([e for e in purchases if e.ts < cutoff], cutoff, active)
    catalog = sorted(active)
    recs = also_bought(mine_rules(train), catalog, ranked, K)
    plain = [p for p, _ in ranked]

    def model(anchor: str) -> list[str]:
        return [r.item_id for r in recs.get(anchor, [])]

    def baseline(anchor: str) -> list[str]:
        return [p for p in plain if p != anchor][:K]

    queries = [(a, items - {a}) for items in test if len(items) >= 2 for a in sorted(items)]
    return Gate(score(model, queries, catalog, K), score(baseline, queries, catalog, K))


def gate_for_you(events: Sequence[Event], active: set[str], cutoff: datetime) -> Gate:
    train = [e for e in events if e.ts < cutoff]
    user_items = build_user_items((e.user, e.product_id, e.event_type) for e in train)
    ranked = _ranked([e for e in train if e.event_type == "PURCHASE"], cutoff, active)
    recs = for_you(user_items, item_similarity(user_items), ranked, K)
    plain = [p for p, _ in ranked]

    # Đáp án: món người dùng có lịch sử MUA sau mốc mà trước mốc chưa từng tương tác
    truth: dict[str, set[str]] = {}
    for e in events:
        if e.ts >= cutoff and e.event_type == "PURCHASE":
            seen = user_items.get(e.user)
            if seen is not None and e.product_id not in seen:
                truth.setdefault(e.user, set()).add(e.product_id)

    def measure(fn: Callable[[str], list[str]]) -> Scores:
        users = sorted(truth)
        shown = {u: fn(u)[:K] for u in users}
        hits = [len(set(shown[u]) & truth[u]) for u in users]
        distinct = {p for lst in shown.values() for p in lst}
        n = len(users)
        return Scores(
            precision=sum(hits) / (K * n) if n else 0.0,
            hit_rate=sum(h > 0 for h in hits) / n if n else 0.0,
            coverage=len(distinct) / len(active) if active else 0.0,
        )

    def model(user: str) -> list[str]:
        return [r.item_id for r in recs.get(user, [])]

    def baseline(user: str) -> list[str]:
        seen = user_items.get(user, {})
        return [p for p in plain if p not in seen][:K]

    return Gate(measure(model), measure(baseline))


def run_job(
    store: RecsStore,
    events: Sequence[Event],
    catalog: Sequence[CatalogItem],
    now: datetime,
    for_you_users: Collection[str] | None = None,
) -> tuple[list[RunResult], dict[str, Gate]]:
    """`for_you_users`: chỉ ghi FOR_YOU cho những người này (dev, staging: người dùng thật, vì người
    dùng giả lập không bao giờ đăng nhập; dữ liệu của họ vẫn dùng để học độ tương tự). None là tất cả."""
    active = {c.product_id for c in catalog if c.status == "ACTIVE"}
    events = [e for e in events if e.ts < now]
    purchases = [e for e in events if e.event_type == "PURCHASE"]
    cutoff = now - timedelta(days=TEST_DAYS)

    gates = {
        "ALSO_BOUGHT": gate_also_bought(purchases, active, cutoff),
        "FOR_YOU": gate_for_you(events, active, cutoff),
    }

    ranked = _ranked(purchases, now, active)
    baskets = [items for _, items in _baskets(purchases).values()]
    user_items = build_user_items((e.user, e.product_id, e.event_type) for e in events)
    basis, best = bestsellers(
        [(e.order_id or "", e.product_id, e.ts) for e in purchases], catalog, now
    )

    personal = for_you(user_items, item_similarity(user_items), ranked)
    if for_you_users is not None:
        personal = {u: recs for u, recs in personal.items() if u in for_you_users}

    results = [
        run_nightly(store, "ALSO_BOUGHT", also_bought(mine_rules(baskets), sorted(active), ranked),
                    gates["ALSO_BOUGHT"].model, gates["ALSO_BOUGHT"].baseline, now),
        run_nightly(store, "FOR_YOU", personal, gates["FOR_YOU"].model, gates["FOR_YOU"].baseline, now),
        run_bestsellers(store, best, basis, now),
    ]
    return results, gates
