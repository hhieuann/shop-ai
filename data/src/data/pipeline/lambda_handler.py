"""
Lambda job đêm, EventBridge Scheduler gọi mỗi đêm (infra/lib/api-stack.ts).

Biến môi trường:
- `RECS_TABLE`, `PRODUCTS_TABLE`, `EVENTS_TABLE`: tên bảng.
- `SYNTHETIC=1` (chỉ dev, staging): trộn thêm dữ liệu giả lập 365 ngày tới hôm qua (UTC) vào sự kiện
  thật, vì hai môi trường này gần như không có người mua thật. Prod chỉ dùng sự kiện thật.
- `PRODUCTS_JSON`: đường dẫn file products.json đóng gói kèm Lambda, generator cần tên và giá để
  chia phân khúc; cùng file seed của bảng products nên mã sản phẩm khớp web.

Lỗi nào cũng ném ra ngoài để Lambda ghi Errors và lần chạy được tính là không thành công (alarm prod).
Log chỉ có số lượng và điểm, không có `userIdHash` hay mã người dùng.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from data.generator import synthetic
from data.pipeline.dynamo import PRODUCT_PROJECTION, DynamoRecsStore, Table, scan_all
from data.pipeline.job import run_job
from data.pipeline.sources import (
    Event,
    Skipped,
    catalog_from_items,
    events_from_items,
    synthetic_events,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SYNTHETIC_DAYS = 365


def synthetic_data(now: datetime, products_json: Path, out_dir: Path) -> list[Event]:
    """Sinh 365 ngày dữ liệu, ngày cuối là hôm qua theo UTC (nhóm chốt 22/10/2026)."""
    end = (now - timedelta(days=1)).date()
    start = end - timedelta(days=SYNTHETIC_DAYS - 1)
    synthetic.main(["--out", str(out_dir), "--start", start.isoformat(), "--end", end.isoformat(),
                    "--products", str(products_json)])
    return synthetic_events(out_dir)


def run(
    recs: Table, products: Table, events: Table, now: datetime, products_json: Path | None
) -> dict[str, Any]:
    skipped = Skipped()
    catalog = catalog_from_items(scan_all(products, **PRODUCT_PROJECTION), skipped)
    real = events_from_items(scan_all(events), skipped)
    fake: list[Event] = []
    if products_json is not None:
        with tempfile.TemporaryDirectory() as tmp:
            fake = synthetic_data(now, products_json, Path(tmp))

    # Có dữ liệu giả lập thì chỉ ghi FOR_YOU cho người dùng thật (userIdHash trong bảng events)
    real_users = {e.user for e in real} if fake else None
    results, gates = run_job(DynamoRecsStore(recs), real + fake, catalog, now, real_users)
    return {
        "products": len(catalog),
        "realEvents": len(real),
        "syntheticEvents": len(fake),
        "skipped": asdict(skipped),
        "gates": {name: {"model": asdict(g.model), "baseline": asdict(g.baseline)} for name, g in gates.items()},
        "results": [asdict(r) for r in results],
    }


def handler(event: object, context: object) -> dict[str, Any]:
    import boto3  # type: ignore[import-not-found]  # có sẵn trong runtime Lambda, không cài ở data/

    db = boto3.resource("dynamodb")
    products_json = os.environ.get("PRODUCTS_JSON") if os.environ.get("SYNTHETIC") == "1" else None
    summary = run(
        db.Table(os.environ["RECS_TABLE"]),
        db.Table(os.environ["PRODUCTS_TABLE"]),
        db.Table(os.environ["EVENTS_TABLE"]),
        datetime.now(UTC),
        Path(products_json) if products_json else None,
    )
    logger.info(json.dumps({"message": "Job gợi ý mỗi đêm xong", **summary}, ensure_ascii=False))
    return summary
