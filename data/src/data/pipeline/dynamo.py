"""
Adapter DynamoDB cho job đêm (dùng `boto3` resource `Table`, có sẵn trong runtime Python của Lambda).

Quyền IAM tương ứng (infra/lib/api-stack.ts, ADR-0017):
- `recs`: BatchWriteItem (ghi dòng, con trỏ), GetItem (đọc con trỏ), Query + UpdateItem (gia hạn ttl).
- `products`: Scan chỉ 4 cột productId, category, status, createdAt.
- `events`: Scan chỉ đọc.

Kiểu `Table` để là Protocol nên test dùng bảng giả, không cần boto3 hay AWS.
"""
from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from decimal import Decimal
from typing import Any, Protocol, Self

from data.pipeline.recs_table import RecType

PRODUCT_PROJECTION = {
    "ProjectionExpression": "productId, category, #s, createdAt",
    # status là từ khoá của DynamoDB nên phải đặt tên thay thế
    "ExpressionAttributeNames": {"#s": "status"},
}


class BatchWriter(Protocol):
    def put_item(self, *, Item: Mapping[str, Any]) -> None: ...

    def __enter__(self) -> Self: ...

    def __exit__(self, *exc: object) -> None: ...


class Table(Protocol):
    def scan(self, **kwargs: Any) -> Mapping[str, Any]: ...

    def query(self, **kwargs: Any) -> Mapping[str, Any]: ...

    def get_item(self, **kwargs: Any) -> Mapping[str, Any]: ...

    def update_item(self, **kwargs: Any) -> Mapping[str, Any]: ...

    def batch_writer(self) -> BatchWriter: ...


def scan_all(table: Table, **kwargs: Any) -> Iterator[Mapping[str, Any]]:
    """Scan hết bảng, theo `LastEvaluatedKey` qua từng trang 1 MB."""
    while True:
        page = table.scan(**kwargs)
        yield from page.get("Items", [])
        last = page.get("LastEvaluatedKey")
        if not last:
            return
        kwargs = {**kwargs, "ExclusiveStartKey": last}


def to_dynamo(value: object) -> object:
    """boto3 không nhận float: đổi sang Decimal (làm tròn 6 chữ số, đủ cho điểm gợi ý)."""
    if isinstance(value, float):
        return Decimal(str(round(value, 6)))
    return value


class DynamoRecsStore:
    def __init__(self, table: Table) -> None:
        self.table = table

    def put_items(self, items: Sequence[Mapping[str, object]]) -> None:
        # batch_writer gom 25 dòng mỗi BatchWriteItem và tự gửi lại phần UnprocessedItems
        with self.table.batch_writer() as writer:
            for item in items:
                writer.put_item(Item={k: to_dynamo(v) for k, v in item.items()})

    def active_version(self, rec_type: RecType) -> int | None:
        item = self.table.get_item(Key={"pk": "META", "sk": f"ACTIVE#{rec_type}"}).get("Item")
        return None if item is None else int(item["activeVersion"])

    def extend_ttl(self, rec_type: RecType, version: int, ttl: int, anchors: Sequence[str]) -> int:
        extended = 0
        for anchor in anchors:
            keys = self.table.query(
                KeyConditionExpression="pk = :pk AND begins_with(sk, :v)",
                ExpressionAttributeValues={":pk": f"{rec_type}#{anchor}", ":v": f"{version}#"},
                ProjectionExpression="pk, sk",
            ).get("Items", [])
            for key in keys:
                self.table.update_item(
                    Key={"pk": key["pk"], "sk": key["sk"]},
                    UpdateExpression="SET #ttl = :ttl",
                    ExpressionAttributeNames={"#ttl": "ttl"},
                    ExpressionAttributeValues={":ttl": ttl},
                )
                extended += 1
        return extended
