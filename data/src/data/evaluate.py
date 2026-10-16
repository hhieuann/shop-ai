"""
Đánh giá offline gợi ý "Thường mua kèm": luật mua kèm so với baseline hàng bán chạy.

Chạy từ thư mục data/, sau khi đã sinh dữ liệu bằng `uv run data --out generated`:
    uv run data-eval --data generated

Cách đánh giá (recommendation.md mục 4):
  - Chỉ dùng đơn `confirmed`. Train và test chia theo thời gian, lấy từ cột SPLIT
    của orders.csv; mô hình và baseline chỉ thấy đơn train.
  - Mỗi đơn test có từ 2 sản phẩm trở lên tạo ra các lượt hỏi: lấy lần lượt từng
    sản phẩm trong đơn làm sản phẩm đang xem; các sản phẩm còn lại trong đơn là đáp án.
  - precision@k: số gợi ý trúng đáp án / k, lấy trung bình trên mọi lượt hỏi.
  - hit rate@k: tỉ lệ lượt hỏi có ít nhất 1 gợi ý trúng.
  - coverage: số sản phẩm khác nhau xuất hiện trong danh sách gợi ý của mọi sản phẩm
    trong danh mục / tổng số sản phẩm. Baseline gần như gợi ý cùng một danh sách cho
    mọi người nên coverage thấp.

Ba cách được so sánh:
  - baseline: k sản phẩm bán chạy nhất trong N ngày trước mốc cắt, bỏ chính sản phẩm đang xem.
  - luật mua kèm: top k theo lift; sản phẩm chưa có luật thì không gợi ý gì.
  - luật mua kèm + baseline: như trên, nhưng sản phẩm chưa có luật thì trả baseline,
    đúng cách API xử lý cold-start (dynamodb-design.md, mục bảng recs).

Không dùng cột IS_NOISE, FROM_CART, file users.csv (persona) — đó là dữ liệu kiểm tra
của script sinh dữ liệu, không phải dữ liệu đưa cho mô hình.
"""
from __future__ import annotations

import argparse
import csv
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from data.baseline.bestseller import bestsellers, top_k_excluding
from data.model.association import mine_rules, top_k


@dataclass(frozen=True)
class OrderRow:
    order_id: str
    ts: datetime
    split: str
    items: frozenset[str]


@dataclass(frozen=True)
class Scores:
    precision: float
    hit_rate: float
    coverage: float


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_confirmed_orders(data_dir: Path) -> list[OrderRow]:
    items_by_order: dict[str, set[str]] = {}
    for row in read_csv(data_dir / "order_items.csv"):
        items_by_order.setdefault(row["ORDER_ID"], set()).add(row["ITEM_ID"])
    return [
        OrderRow(
            row["ORDER_ID"],
            datetime.fromisoformat(row["TS_ISO"]),
            row["SPLIT"],
            frozenset(items_by_order.get(row["ORDER_ID"], set())),
        )
        for row in read_csv(data_dir / "orders.csv")
        if row["STATUS"] == "confirmed"
    ]


def score(
    recommend: Callable[[str], list[str]],
    queries: list[tuple[str, frozenset[str]]],
    catalog: list[str],
    k: int,
) -> Scores:
    """Tính precision@k, hit rate@k trên các lượt hỏi và coverage trên cả danh mục."""
    hits = [len(set(recommend(anchor)[:k]) & truth) for anchor, truth in queries]
    shown = {item for anchor in catalog for item in recommend(anchor)[:k]}
    n = len(queries)
    return Scores(
        precision=sum(hits) / (k * n) if n else 0.0,
        hit_rate=sum(h > 0 for h in hits) / n if n else 0.0,
        coverage=len(shown) / len(catalog) if catalog else 0.0,
    )


def evaluate(
    data_dir: Path,
    k: int = 10,
    window_days: int = 30,
    min_pair_count: int = 2,
    min_confidence: float = 0.05,
) -> dict:
    orders = load_confirmed_orders(data_dir)
    train = [o for o in orders if o.split == "train"]
    test = [o for o in orders if o.split == "test"]
    if not train or not test:
        raise ValueError("Cần có đơn confirmed ở cả train và test (cột SPLIT của orders.csv).")
    catalog = sorted(row["ITEM_ID"] for row in read_csv(data_dir / "products.csv"))

    # Mốc cắt: ngay sau đơn train cuối cùng, nên baseline không thấy đơn test nào
    until = max(o.ts for o in train) + timedelta(seconds=1)
    ranked = bestsellers(((i, o.ts) for o in train for i in o.items), until, window_days)
    rules = mine_rules((o.items for o in train), min_pair_count, min_confidence)

    def baseline(anchor: str) -> list[str]:
        return top_k_excluding(ranked, anchor, k)

    def rules_only(anchor: str) -> list[str]:
        return top_k(rules, anchor, k)

    def rules_with_fallback(anchor: str) -> list[str]:
        return rules_only(anchor) or baseline(anchor)

    queries = [
        (anchor, o.items - {anchor})
        for o in test
        if len(o.items) >= 2
        for anchor in sorted(o.items)
    ]
    results = {
        name: score(fn, queries, catalog, k)
        for name, fn in (
            ("baseline", baseline),
            ("luat_mua_kem", rules_only),
            ("luat_mua_kem_va_baseline", rules_with_fallback),
        )
    }
    return {
        "k": k,
        "window_days": window_days,
        "min_pair_count": min_pair_count,
        "min_confidence": min_confidence,
        "train_orders": len(train),
        "test_orders": len(test),
        "queries": len(queries),
        "products": len(catalog),
        "products_with_rules": sum(1 for item in catalog if rules.get(item)),
        "scores": {name: vars(s) for name, s in results.items()},
    }


def to_markdown(report: dict) -> str:
    k = report["k"]
    labels = {
        "baseline": f"Baseline: bán chạy {report['window_days']} ngày",
        "luat_mua_kem": "Luật mua kèm",
        "luat_mua_kem_va_baseline": "Luật mua kèm, thiếu luật thì dùng baseline",
    }
    lines = [
        f"| Cách gợi ý | precision@{k} | hit rate@{k} | coverage |",
        "|---|---|---|---|",
    ]
    for name, s in report["scores"].items():
        lines.append(
            f"| {labels[name]} | {s['precision']:.4f} | {s['hit_rate']:.4f} | {s['coverage']:.4f} |"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> dict:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="generated", help="Thư mục đầu ra của `uv run data`")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--window-days", type=int, default=30, help="N ngày cho baseline bán chạy")
    ap.add_argument("--min-pair-count", type=int, default=2, help="Số đơn tối thiểu có cả hai sản phẩm")
    ap.add_argument("--min-confidence", type=float, default=0.05)
    args = ap.parse_args(argv)

    report = evaluate(Path(args.data), args.k, args.window_days, args.min_pair_count, args.min_confidence)
    print(json.dumps({key: v for key, v in report.items() if key != "scores"}, ensure_ascii=False, indent=2))
    print()
    print(to_markdown(report))
    return report


def cli() -> None:
    """Điểm vào của lệnh `uv run data-eval`: không trả giá trị để thoát với mã 0."""
    main()


if __name__ == "__main__":
    cli()
