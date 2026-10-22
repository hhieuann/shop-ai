"""
Gợi ý theo món tương tự (item-based collaborative filtering) cho "Dành cho bạn"
(ADR-0016, recommendation.md mục 2.2).

Chỉ dùng thư viện chuẩn của Python. Ở quy mô demo (vài trăm sản phẩm), tính trên
dict thưa đủ nhanh; khi cần mới thêm numpy.

1. Mỗi cặp (người dùng, sản phẩm) có một điểm tương tác bằng trọng số LỚN NHẤT trong
   các sự kiện của cặp đó. Lấy lớn nhất thay vì cộng dồn, nên spam một sản phẩm nhiều
   lần không làm điểm tăng thêm (threat model E2: giới hạn trọng số mỗi cặp user, item).
2. Độ tương tự cosine giữa hai sản phẩm, tính trên vector điểm theo người dùng.
3. Điểm gợi ý sản phẩm j cho người dùng u = tổng điểm(u, i) × cosine(i, j) trên các
   sản phẩm i người dùng đã tương tác; bỏ sản phẩm người dùng đã tương tác.
"""
from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable, Mapping

# Trọng số tạm, chưa chốt (recommendation.md mục 5). remove_from_cart không tính.
DEFAULT_WEIGHTS: dict[str, float] = {"view": 1.0, "add_to_cart": 3.0, "purchase": 5.0}

UserItems = dict[str, dict[str, float]]
Similarity = dict[str, dict[str, float]]


def build_user_items(
    events: Iterable[tuple[str, str, str]],
    weights: Mapping[str, float] = DEFAULT_WEIGHTS,
) -> UserItems:
    """Từ các sự kiện (user, item, loại sự kiện) ra {user: {item: điểm lớn nhất}}."""
    user_items: UserItems = defaultdict(dict)
    for user, item, event_type in events:
        w = weights.get(event_type, 0.0)
        if w <= 0:
            continue
        current = user_items[user]
        current[item] = max(current.get(item, 0.0), w)
    return dict(user_items)


def item_similarity(user_items: UserItems) -> Similarity:
    """Cosine giữa mọi cặp sản phẩm có ít nhất một người dùng chung."""
    norm_sq: dict[str, float] = defaultdict(float)
    dot: dict[tuple[str, str], float] = defaultdict(float)
    for items in user_items.values():
        ranked = sorted(items.items())
        for idx, (a, wa) in enumerate(ranked):
            norm_sq[a] += wa * wa
            for b, wb in ranked[idx + 1 :]:
                dot[(a, b)] += wa * wb

    sim: Similarity = defaultdict(dict)
    for (a, b), value in dot.items():
        cosine = value / math.sqrt(norm_sq[a] * norm_sq[b])
        sim[a][b] = cosine
        sim[b][a] = cosine
    return dict(sim)


def recommend_for_user(
    user_items: UserItems,
    sim: Similarity,
    user: str,
    k: int = 10,
) -> list[str]:
    """Top k sản phẩm cho một người dùng; rỗng nếu người dùng chưa có lịch sử (cold-start)."""
    seen = user_items.get(user, {})
    scores: dict[str, float] = defaultdict(float)
    for item, w in seen.items():
        for other, s in sim.get(item, {}).items():
            if other not in seen:
                scores[other] += w * s
    ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    return [item for item, _ in ranked[:k]]
