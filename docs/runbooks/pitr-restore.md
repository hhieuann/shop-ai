# Runbook: khôi phục bảng DynamoDB bằng point-in-time recovery

Không có alarm. Dùng khi dữ liệu đơn hàng hoặc sản phẩm bị xoá, ghi sai hàng loạt, và để diễn tập P3 trong [checklist rc.1](../releases/v1.0.0-rc.1.md). Mục tiêu: RPO ≤ 5 phút, RTO ≤ 1 giờ cho dữ liệu đơn hàng (engineering-plan.md mục 3, ADR-0012). Người trực: An.

Bảng có PITR: `orders` và `products` ở mọi môi trường (`api-stack.ts`). PITR giữ 35 ngày, khôi phục được tới khoảng 5 phút trước. Khôi phục luôn tạo **bảng mới**, không ghi đè bảng cũ.

## Bảng mới có và không có gì

| Có | Không có, phải tự đặt nếu dùng lâu |
|---|---|
| Toàn bộ item tại thời điểm chọn, các GSI (`byStatus` của `orders`) | PITR, TTL (`expiresAt`), deletion protection, tag `project`, `env` |

Bảng mới **không** thuộc stack CloudFormation và Lambda **không** có quyền IAM trên nó (quyền gắn với ARN bảng cũ). Vì vậy không trỏ Lambda sang bảng mới bằng cách đổi biến môi trường: sẽ lỗi `AccessDeniedException` và bị lần deploy sau ghi đè.

## Diễn tập trên staging (P3)

Chỉ đọc bảng staging và tạo một bảng tạm, không đụng dữ liệu đang chạy. Chi phí khôi phục và lưu trữ bảng tạm vài KB không đáng kể; xoá bảng tạm sau khi xong.

```bash
SRC=$(aws dynamodb list-tables --region ap-southeast-1 --query "TableNames[?starts_with(@,'shop-stg-api-OrdersTable')]|[0]" --output text)
DST="shop-stg-orders-pitr-drill-$(date +%Y%m%d%H%M)"
echo "$SRC -> $DST"

# 1. Xem khoảng thời gian khôi phục được
aws dynamodb describe-continuous-backups --region ap-southeast-1 --table-name "$SRC" \
  --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.[EarliestRestorableDateTime,LatestRestorableDateTime]'

# 2. Ghi giờ bắt đầu, khôi phục về thời điểm muộn nhất có thể
date -u +%FT%TZ
aws dynamodb restore-table-to-point-in-time --region ap-southeast-1 \
  --source-table-name "$SRC" --target-table-name "$DST" \
  --use-latest-restorable-time --billing-mode-override PAY_PER_REQUEST \
  --query 'TableDescription.TableStatus'

# 3. Chờ bảng mới ACTIVE, ghi giờ xong: hiệu hai mốc là thời gian khôi phục.
#    Waiter chỉ chờ tối đa khoảng 8 phút; báo hết giờ thì chạy lại lệnh wait, chưa phải lỗi.
aws dynamodb wait table-exists --region ap-southeast-1 --table-name "$DST"
date -u +%FT%TZ
```

Khôi phục mất vài phút tới hơn 10 phút **kể cả khi bảng chỉ vài KB**: thời gian chủ yếu là AWS dựng bảng, không tỉ lệ với dữ liệu.

4. So bảng mới với bảng cũ (số item quét được, không ghi dữ liệu khách vào ghi chú):

   ```bash
   aws dynamodb scan --region ap-southeast-1 --table-name "$SRC" --select COUNT --query Count
   aws dynamodb scan --region ap-southeast-1 --table-name "$DST" --select COUNT --query Count
   aws dynamodb describe-table --region ap-southeast-1 --table-name "$DST" \
     --query 'Table.GlobalSecondaryIndexes[].[IndexName,IndexStatus]'
   ```

   Hai số bằng nhau (hoặc lệch đúng số đơn đặt trong vài phút gần nhất) và `byStatus` ở `ACTIVE` là đạt.

5. Xoá bảng tạm, kiểm không còn:

   ```bash
   aws dynamodb delete-table --region ap-southeast-1 --table-name "$DST" --query 'TableDescription.TableStatus'
   aws dynamodb list-tables --region ap-southeast-1 --query "TableNames[?contains(@,'pitr-drill')]"
   ```

6. Ghi vào checklist rc.1 (P3): thời điểm khôi phục, thời gian từ bước 2 tới bước 3, số item hai bảng. RTO thật gồm cả thời gian chép dữ liệu về (mục dưới), nên ghi rõ đây mới là phần khôi phục.

### Lần diễn tập 09/11/2026 (An)

| Mục | Kết quả |
|---|---|
| Bảng nguồn | `shop-stg-api-OrdersTable315BB997-…`, 23 item, khoảng 9 KB, PITR từ 03/11 |
| Khôi phục về | 01:32:14 UTC (muộn nhất có thể lúc chạy), bắt đầu 01:37:13 UTC |
| ACTIVE | Sau 01:40:20 và trước 01:46:53 UTC: **3–10 phút** |
| So sánh | 23 = 23 item; `byStatus` ACTIVE |
| Bảng mới thiếu | TTL `DISABLED`, PITR `DISABLED`, deletion protection tắt, đúng như bảng ở trên |
| Dọn | `delete-table` xong, `list-tables` không còn bảng `pitr-drill` |

Phần khôi phục nằm rất xa trong RTO 1 giờ. Bước chép về bảng cũ chưa đo.

## Sự cố thật trên prod

1. Dừng nguồn gây hỏng trước: rollback bản lỗi ([api-5xx.md](api-5xx.md) mục Giảm thiểu), dừng job hay script đang ghi sai.
2. Xác định giờ dữ liệu còn đúng (log, X-Ray, `updatedAt`). Khôi phục bảng `shop-prd-api-OrdersTable…` sang bảng mới như bước 2–3 ở trên, nhưng dùng `--restore-date-time <giờ còn đúng>` thay cho `--use-latest-restorable-time`.
3. Tìm item khác nhau giữa hai bảng: chỉ các đơn bị xoá hoặc ghi sai sau giờ đó.
4. Chép các item đó **về bảng cũ** bằng `put-item` từng item, có `--condition-expression` để không ghi đè đơn khách vừa đặt sau sự cố. Không chuyển ứng dụng sang bảng mới (xem mục đầu).
5. Kiểm lại bằng đúng các đơn bị ảnh hưởng trên web; xoá bảng tạm; viết postmortem theo `docs/postmortems/_template.md` trong 48 giờ.

Bước 3–4 chưa được diễn tập. Có sự cố thật thì làm cùng người thứ hai, và chép thử 1 item trước.
