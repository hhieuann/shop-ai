"""
Một lần chạy job đêm cho một loại gợi ý (recommendation.md mục 3, "Vòng đời một lần chạy"):

1. Ghi đủ các dòng của phiên bản mới (chưa đổi con trỏ).
2. So chỉ số của phiên bản mới với baseline.
3. Không kém baseline ở cả precision@10 và coverage: chuyển con trỏ sang phiên bản mới.
4. Kém hơn: giữ con trỏ, gia hạn `ttl` các dòng của phiên bản đang ACTIVE để chúng không hết hạn.

Kho lưu trữ là một Protocol: test dùng bản trong bộ nhớ, Lambda dùng adapter DynamoDB.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from data.evaluate import Scores
from data.pipeline.recs_table import (
    Rec,
    RecType,
    expires_at,
    pointer_item,
    row_items,
    version_for,
)


class RecsStore(Protocol):
    def put_items(self, items: Sequence[Mapping[str, object]]) -> None: ...

    def active_version(self, rec_type: RecType) -> int | None: ...

    def extend_ttl(self, rec_type: RecType, version: int, ttl: int, anchors: Sequence[str]) -> int:
        """Đặt `ttl` mới cho các dòng của phiên bản thuộc `anchors`; trả về số dòng đã gia hạn.

        Bảng recs chỉ Query được theo pk, nên cần biết anchor; dùng anchor của lần chạy này.
        Anchor không còn (sản phẩm ngừng bán, người dùng hết sự kiện) thì để dòng cũ tự hết hạn."""
        ...


@dataclass(frozen=True)
class RunResult:
    rec_type: RecType
    version: int
    rows_written: int
    activated: bool
    active_version: int | None
    reason: str


def not_worse(model: Scores, baseline: Scores) -> bool:
    return model.precision >= baseline.precision and model.coverage >= baseline.coverage


def run_nightly(
    store: RecsStore,
    rec_type: RecType,
    recs: Mapping[str, Sequence[Rec]],
    model_scores: Scores,
    baseline_scores: Scores,
    now: datetime,
) -> RunResult:
    version = version_for(now)
    rows = row_items(rec_type, version, recs, now)
    store.put_items(rows)

    if not_worse(model_scores, baseline_scores):
        store.put_items([pointer_item(rec_type, version, now)])
        return RunResult(rec_type, version, len(rows), True, version, "không kém baseline")

    active = store.active_version(rec_type)
    if active is not None and active != version:
        store.extend_ttl(rec_type, active, expires_at(now), sorted(recs))
    return RunResult(rec_type, version, len(rows), False, active, "kém baseline, giữ phiên bản cũ")


def run_bestsellers(
    store: RecsStore, recs: Mapping[str, Sequence[Rec]], basis: str, now: datetime
) -> RunResult:
    """Hàng bán chạy chính là baseline nên luôn bật; `basis` cho API biết cách xếp (NEWEST là chưa đủ đơn)."""
    version = version_for(now)
    rows = row_items("BESTSELLER", version, recs, now)
    store.put_items(rows)
    store.put_items([pointer_item("BESTSELLER", version, now, basis)])
    return RunResult("BESTSELLER", version, len(rows), True, version, basis)
