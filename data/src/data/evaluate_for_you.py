"""
Đánh giá offline gợi ý "Dành cho bạn": item-based CF so với baseline hàng bán chạy.

Chạy từ thư mục data/, sau khi đã sinh dữ liệu bằng `uv run data --out generated`:
    uv run data-eval-for-you --data generated

Cách đánh giá (recommendation.md mục 4):
  - Train là interactions_train.csv, test là interactions_test.csv (đã chia theo thời gian).
  - Đáp án của một người dùng: các sản phẩm người đó MUA trong test mà chưa từng
    tương tác trong train. Chỉ chấm người dùng có lịch sử trong train và có đáp án.
  - precision@k, hit rate@k: như `data-eval` (xem evaluate.py), lấy trung bình theo người dùng.
  - coverage: số sản phẩm khác nhau xuất hiện trong gợi ý của những người dùng được
    chấm / tổng số sản phẩm.

Hai cách được so sánh:
  - baseline: k sản phẩm bán chạy nhất trong N ngày trước mốc cắt, bỏ sản phẩm người
    dùng đã tương tác.
  - item-based CF: sản phẩm tương tự với những gì người dùng đã xem, thêm giỏ, mua.
Người dùng chưa có lịch sử (cold-start) dùng baseline (ADR-0016) nên không chấm ở đây.
"""
from __future__ import annotations

import argparse
import json
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from data.baseline.bestseller import bestsellers
from data.evaluate import Scores, read_csv
from data.model.item_cf import build_user_items, item_similarity, recommend_for_user


def evaluate_for_you(data_dir: Path, k: int = 10, window_days: int = 30) -> dict:
    train = read_csv(data_dir / "interactions_train.csv")
    test = read_csv(data_dir / "interactions_test.csv")
    if not train or not test:
        raise ValueError("Cần có dữ liệu ở cả interactions_train.csv và interactions_test.csv.")
    catalog = sorted(row["ITEM_ID"] for row in read_csv(data_dir / "products.csv"))

    user_items = build_user_items((r["USER_ID"], r["ITEM_ID"], r["EVENT_TYPE"]) for r in train)
    sim = item_similarity(user_items)

    # Mốc cắt: ngay sau sự kiện train cuối cùng, nên baseline không thấy dữ liệu test
    until = datetime.fromtimestamp(max(int(r["TIMESTAMP"]) for r in train) + 1, UTC)
    ranked = bestsellers(
        (
            (r["ITEM_ID"], datetime.fromtimestamp(int(r["TIMESTAMP"]), UTC))
            for r in train
            if r["EVENT_TYPE"] == "purchase"
        ),
        until,
        window_days,
    )

    def baseline(user: str) -> list[str]:
        seen = user_items.get(user, {})
        return [item for item in ranked if item not in seen][:k]

    def cf_only(user: str) -> list[str]:
        return recommend_for_user(user_items, sim, user, k)

    truth: dict[str, set[str]] = {}
    for r in test:
        user, item = r["USER_ID"], r["ITEM_ID"]
        if r["EVENT_TYPE"] == "purchase" and user in user_items and item not in user_items[user]:
            truth.setdefault(user, set()).add(item)
    users = sorted(truth)

    def measure(fn: Callable[[str], list[str]]) -> Scores:
        recs = {user: fn(user)[:k] for user in users}
        hits = [len(set(recs[user]) & truth[user]) for user in users]
        shown = {item for lst in recs.values() for item in lst}
        return Scores(
            precision=sum(hits) / (k * len(users)) if users else 0.0,
            hit_rate=sum(h > 0 for h in hits) / len(users) if users else 0.0,
            coverage=len(shown) / len(catalog) if catalog else 0.0,
        )

    results = {
        "baseline": measure(baseline),
        "item_cf": measure(cf_only),
    }
    return {
        "k": k,
        "window_days": window_days,
        "train_users": len(user_items),
        "users_evaluated": len(users),
        "products": len(catalog),
        "scores": {name: vars(s) for name, s in results.items()},
    }


def to_markdown(report: dict) -> str:
    k = report["k"]
    labels = {
        "baseline": f"Baseline: bán chạy {report['window_days']} ngày",
        "item_cf": "Item-based CF",
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
    args = ap.parse_args(argv)

    report = evaluate_for_you(Path(args.data), args.k, args.window_days)
    print(json.dumps({key: v for key, v in report.items() if key != "scores"}, ensure_ascii=False, indent=2))
    print()
    print(to_markdown(report))
    return report


def cli() -> None:
    """Điểm vào của lệnh `uv run data-eval-for-you`: không trả giá trị để thoát với mã 0."""
    main()


if __name__ == "__main__":
    cli()
