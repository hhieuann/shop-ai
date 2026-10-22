"""
Dòng của bảng `recs` theo docs/business/dynamodb-design.md, mục "Bảng `recs`".

- Dòng gợi ý: pk = `<recType>#<anchorId>`, sk = `<version>#<rank>` (rank đệm 2 chữ số, 01–10).
- Con trỏ: pk = `META`, sk = `ACTIVE#<recType>`, giữ `activeVersion`.
- `ttl` của dòng gợi ý = lúc ghi + 7 ngày; con trỏ không có `ttl`.

Chỉ dựng dữ liệu, không gọi AWS; phần ghi DynamoDB nằm ở adapter riêng.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

RecType = Literal["FOR_YOU", "ALSO_BOUGHT"]
Source = Literal["ASSOCIATION_RULE", "ITEM_CF", "BESTSELLER"]

TOP_K = 10
ROW_TTL = timedelta(days=7)


@dataclass(frozen=True)
class Rec:
    """Một gợi ý cho một anchor (người dùng với FOR_YOU, sản phẩm với ALSO_BOUGHT)."""

    item_id: str
    score: float
    source: Source


def iso(ts: datetime) -> str:
    return ts.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def version_for(run_at: datetime) -> int:
    """Phiên bản theo ngày chạy (UTC), ví dụ 20261022. Chạy lại trong ngày ra cùng phiên bản,
    nên ghi lại đúng các dòng cũ thay vì tạo thêm (recommendation.md mục 3, bước 5)."""
    return int(run_at.astimezone(UTC).strftime("%Y%m%d"))


def expires_at(ts: datetime) -> int:
    return int((ts + ROW_TTL).timestamp())


def row_items(
    rec_type: RecType,
    version: int,
    recs: Mapping[str, Sequence[Rec]],
    generated_at: datetime,
    k: int = TOP_K,
) -> list[dict[str, object]]:
    """Các dòng gợi ý của một phiên bản. Anchor không có gợi ý nào thì không có dòng:
    API trả baseline bán chạy cho anchor đó (ADR-0016)."""
    ttl = expires_at(generated_at)
    items: list[dict[str, object]] = []
    for anchor in sorted(recs):
        for rank, rec in enumerate(recs[anchor][:k], start=1):
            items.append(
                {
                    "pk": f"{rec_type}#{anchor}",
                    "sk": f"{version}#{rank:02d}",
                    "itemId": rec.item_id,
                    "score": rec.score,
                    "source": rec.source,
                    "generatedAt": iso(generated_at),
                    "ttl": ttl,
                }
            )
    return items


def pointer_item(rec_type: RecType, version: int, updated_at: datetime) -> dict[str, object]:
    return {
        "pk": "META",
        "sk": f"ACTIVE#{rec_type}",
        "activeVersion": version,
        "updatedAt": iso(updated_at),
    }
