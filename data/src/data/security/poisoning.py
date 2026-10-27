"""
Thí nghiệm đầu độc gợi ý (threat model E2): nhiều tài khoản ảo spam `VIEW`, `ADD_TO_CART` để đẩy một
sản phẩm ít người mua vào "Dành cho bạn" của người dùng thật.

Kẻ tấn công: mỗi tài khoản ảo xem sản phẩm mục tiêu cùng vài món bán chạy nhất (để item-based CF
coi mục tiêu "giống" các món đó), lặp lại `repeats` lần, rồi thêm giỏ mục tiêu.

Đo: tỉ lệ người dùng thật có mục tiêu trong top 10 "Dành cho bạn" (exposure), và số sản phẩm có mục
tiêu trong top 10 "Thường mua kèm". So hai cách gộp sự kiện của một cặp (người dùng, sản phẩm):
- `sum`: cộng dồn mọi lượt (cách hay gặp), spam lặp lại thì điểm tăng mãi;
- `max`: chỉ lấy trọng số lớn nhất (cách pipeline đang dùng, data.model.item_cf), lặp lại vô ích.

Chạy từ thư mục data/:
    uv run data-poison                 # dữ liệu giả lập seed 42, in bảng markdown
"""
from __future__ import annotations

import argparse
import tempfile
from collections import Counter, defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from data.console import use_utf8_output
from data.generator import synthetic
from data.model.association import mine_rules
from data.model.item_cf import (
    DEFAULT_WEIGHTS,
    UserItems,
    build_user_items,
    item_similarity,
)
from data.pipeline.build import also_bought, bestseller_counts, for_you
from data.pipeline.sources import Event, synthetic_events

K = 10
DECOYS = 5


def build_user_items_sum(events: Iterable[tuple[str, str, str]]) -> UserItems:
    """Như build_user_items nhưng cộng dồn trọng số: cách gộp dễ bị spam lặp lại."""
    out: defaultdict[str, dict[str, float]] = defaultdict(dict)
    for user, item, kind in events:
        w = DEFAULT_WEIGHTS.get(kind, 0.0)
        if w > 0:
            out[user][item] = out[user].get(item, 0.0) + w
    return dict(out)


def attack_events(
    target: str, decoys: Sequence[str], accounts: int, repeats: int, at: datetime
) -> list[Event]:
    """Sự kiện của `accounts` tài khoản ảo; chỉ VIEW và ADD_TO_CART vì API chặn PURCHASE (E1)."""
    out: list[Event] = []
    for a in range(accounts):
        user = f"attacker-{a:03d}"
        for r in range(repeats):
            ts = at + timedelta(seconds=a * repeats + r)
            out.extend(Event(user, p, "VIEW", ts) for p in (target, *decoys))
        out.append(Event(user, target, "ADD_TO_CART", at))
    return out


@dataclass(frozen=True)
class Exposure:
    for_you: float  # tỉ lệ người dùng thật có mục tiêu trong top K
    also_bought: int  # số sản phẩm có mục tiêu trong top K "Thường mua kèm"


def exposure(
    events: Sequence[Event], target: str, catalog: Sequence[str], real_users: set[str], weighting: str
) -> Exposure:
    rows = [(e.user, e.product_id, e.event_type) for e in events]
    user_items = build_user_items_sum(rows) if weighting == "sum" else build_user_items(rows)
    purchases = [e for e in events if e.event_type == "PURCHASE"]
    until = max(e.ts for e in events) + timedelta(seconds=1)
    ranked = bestseller_counts(((e.product_id, e.ts) for e in purchases), until)

    personal = for_you(user_items, item_similarity(user_items), ranked, K)
    users = [u for u in real_users if u in personal]
    hit = sum(target in {r.item_id for r in personal[u]} for u in users)

    baskets: defaultdict[str, set[str]] = defaultdict(set)
    for e in purchases:
        baskets[e.order_id or ""].add(e.product_id)
    pairs = also_bought(mine_rules(baskets.values()), catalog, ranked, K)
    return Exposure(
        for_you=hit / len(users) if users else 0.0,
        also_bought=sum(target in {r.item_id for r in recs} for a, recs in pairs.items() if a != target),
    )


@dataclass(frozen=True)
class Row:
    accounts: int
    repeats: int
    weighting: str
    for_you: float
    also_bought: int
    target: str


def pick_target(events: Sequence[Event], catalog: Sequence[str]) -> tuple[str, list[str]]:
    """Mục tiêu: sản phẩm ít người mua nhất (hoà theo mã); mồi: DECOYS món bán chạy nhất."""
    bought = Counter(e.product_id for e in events if e.event_type == "PURCHASE")
    ordered = sorted(catalog, key=lambda p: (bought[p], p))
    return ordered[0], sorted(catalog, key=lambda p: (-bought[p], p))[:DECOYS]


def run_experiment(
    events: Sequence[Event],
    catalog: Sequence[str],
    accounts: Sequence[int] = (0, 5, 20, 50),
    repeats: Sequence[int] = (1, 50),
) -> list[Row]:
    target, decoys = pick_target(events, catalog)
    real_users = {e.user for e in events}
    at = max(e.ts for e in events)
    rows: list[Row] = []
    for n in accounts:
        for r in repeats if n else (1,):
            poisoned = list(events) + attack_events(target, decoys, n, r, at)
            for weighting in ("sum", "max"):
                exp = exposure(poisoned, target, catalog, real_users, weighting)
                rows.append(Row(n, r, weighting, exp.for_you, exp.also_bought, target))
    return rows


def to_markdown(rows: Sequence[Row]) -> str:
    lines = [
        (
            f"Mục tiêu: `{rows[0].target}` (sản phẩm ít người mua nhất). Exposure = % người dùng thật "
            f"có mục tiêu trong top {K} \"Dành cho bạn\"; cột cuối = số sản phẩm có mục tiêu trong top {K} "
            "\"Thường mua kèm\"."
        ),
        "",
        "| Tài khoản ảo | Lặp mỗi tài khoản | Gộp `sum` | Gộp `max` (đang dùng) | Thường mua kèm |",
        "|---|---|---|---|---|",
    ]
    by_key: defaultdict[tuple[int, int], dict[str, Row]] = defaultdict(dict)
    for row in rows:
        by_key[(row.accounts, row.repeats)][row.weighting] = row
    for (n, r), pair in by_key.items():
        lines.append(
            f"| {n} | {r if n else '–'} | {pair['sum'].for_you:.1%} "
            f"| {pair['max'].for_you:.1%} | {pair['max'].also_bought} |"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> list[Row]:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args(argv)
    with tempfile.TemporaryDirectory() as tmp:
        synthetic.main(["--out", tmp, "--seed", str(args.seed)])
        events = synthetic_events(Path(tmp))
        catalog = sorted({e.product_id for e in events})
    rows = run_experiment(events, catalog)
    print(to_markdown(rows))
    return rows


def cli() -> None:
    use_utf8_output()
    main()
