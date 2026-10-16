"""
Luật mua kèm (association rules) cho gợi ý "Thường mua kèm" (ADR-0016, recommendation.md mục 2.1).

Chỉ dùng thư viện chuẩn của Python để gói Lambda nhỏ (ADR-0016: giới hạn 250 MB).

Với mỗi cặp sản phẩm (A, B) cùng nằm trong một đơn:
  - support(A, B)    = số đơn có cả A và B / tổng số đơn
  - confidence(A→B)  = số đơn có cả A và B / số đơn có A
  - lift(A→B)        = confidence(A→B) / (số đơn có B / tổng số đơn)

Lọc theo số đơn tối thiểu có cả A và B và confidence tối thiểu, rồi xếp theo lift
(cao trước), hoà thì xếp theo confidence, rồi theo mã sản phẩm để kết quả ổn định.
"""
from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from itertools import combinations


@dataclass(frozen=True)
class Rule:
    antecedent: str
    consequent: str
    pair_count: int
    support: float
    confidence: float
    lift: float


def mine_rules(
    baskets: Iterable[Iterable[str]],
    min_pair_count: int = 2,
    min_confidence: float = 0.05,
) -> dict[str, list[Rule]]:
    """Trả về {món kích hoạt: các luật đã xếp hạng}. Mỗi giỏ là tập mã sản phẩm của một đơn."""
    item_count: Counter[str] = Counter()
    pair_count: Counter[tuple[str, str]] = Counter()
    n_baskets = 0
    for basket in baskets:
        items = sorted(set(basket))
        if not items:
            continue
        n_baskets += 1
        item_count.update(items)
        pair_count.update(combinations(items, 2))

    rules: dict[str, list[Rule]] = {}
    for (a, b), n_ab in pair_count.items():
        if n_ab < min_pair_count:
            continue
        for x, y in ((a, b), (b, a)):
            confidence = n_ab / item_count[x]
            if confidence < min_confidence:
                continue
            lift = confidence / (item_count[y] / n_baskets)
            rules.setdefault(x, []).append(
                Rule(x, y, n_ab, n_ab / n_baskets, confidence, lift)
            )

    for lst in rules.values():
        lst.sort(key=lambda r: (-r.lift, -r.confidence, r.consequent))
    return rules


def top_k(rules: dict[str, list[Rule]], anchor: str, k: int = 10) -> list[str]:
    """Top k sản phẩm mua kèm cho một sản phẩm; rỗng nếu chưa có luật nào (cold-start)."""
    return [r.consequent for r in rules.get(anchor, [])[:k]]
