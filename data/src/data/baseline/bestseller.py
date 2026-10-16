"""
Baseline hàng bán chạy (ADR-0016, recommendation.md mục 2.3).

Đếm số lần mua theo sản phẩm trong N ngày gần nhất trước mốc cắt, từ các đơn
`confirmed`. Dùng cho người mới, sản phẩm chưa có luật mua kèm, và là mốc so sánh
bắt buộc cho mô hình.
"""
from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from datetime import datetime, timedelta


def bestsellers(
    purchases: Iterable[tuple[str, datetime]],
    until: datetime,
    window_days: int = 30,
) -> list[str]:
    """Mã sản phẩm xếp theo số lần mua trong [until - window_days, until), nhiều trước.

    Hoà thì xếp theo mã sản phẩm để kết quả ổn định giữa các lần chạy.
    """
    since = until - timedelta(days=window_days)
    counts: Counter[str] = Counter(item for item, ts in purchases if since <= ts < until)
    return [item for item, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


def top_k_excluding(ranked: list[str], exclude: str, k: int = 10) -> list[str]:
    """Top k từ danh sách bán chạy, bỏ chính sản phẩm đang xem."""
    return [item for item in ranked if item != exclude][:k]
