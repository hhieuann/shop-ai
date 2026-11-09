# tests/load

Load test bằng k6. An phụ trách.

| File | Dùng khi |
|---|---|
| `smoke.js` | Kịch bản rất nhỏ (1 người ảo, 30 giây, chỉ đọc), chạy mỗi đêm vào staging qua CloudFront (`nightly.yml`) |
| `tiers.js` | Đo P2 cho checklist phát hành: 50 và 200 người ảo đọc, kèm 1 người ảo đặt rồi huỷ đơn; chạy tay |

Chạy bằng Docker, không cần cài k6:

```bash
docker run --rm -i -e BASE_URL=https://<cloudfront-staging> grafana/k6:2.3.0 run - < tests/load/smoke.js
docker run --rm -i -e BASE_URL=https://<api-gateway-url> -e TIER=200 grafana/k6:2.3.0 run - < tests/load/tiers.js
```

## tiers.js

- `BASE_URL` là URL API Gateway (output `ApiUrl` của stack `shop-stg-api`), không qua CloudFront và WAF, để không bị rule giới hạn tốc độ chặn và đo đúng thời gian của API.
- `TIER` là số người ảo đọc (mặc định 50). Mỗi người nghỉ 3–6 giây giữa hai lần bấm. `RAMP` (mặc định `1m`) và `HOLD` (mặc định `3m`) đổi thời gian tăng tải và giữ tải.
- Stage API Gateway giới hạn 50 request mỗi giây, burst 100 (`api-stack.ts`). 200 người ảo khoảng 45 request mỗi giây, nên kết quả là của API dưới giới hạn đó. Muốn thử 1.000 người ảo thì phải nâng giới hạn stage trước, và ghi rõ trong báo cáo.
- Phần ghi chỉ chạy khi có `E2E_USERNAME`, `E2E_PASSWORD`, `COGNITO_CLIENT_ID` (app client E2E, chỉ có ở dev và staging). 1 người ảo đặt rồi huỷ ngay từng đơn, vì mỗi tài khoản tối đa 3 đơn đang mở (ordering.md BR-14). Đơn đặt rồi huỷ vẫn tạo sự kiện mua và thư bị SES từ chối, như E2E.
- Ngưỡng: đọc p95 ≤ 300 ms, đặt hàng p95 ≤ 800 ms, lỗi dưới 1% (engineering-plan.md mục 3). Không đạt thì k6 thoát mã khác 0.
- Trước khi chạy, xem hạn mức ở Service Quotas → AWS Lambda → Concurrent executions. Gặp throttle (429) thì ghi vào báo cáo.

Không có bản đối chứng EC2 (hoãn, checklist rc.1 mục 0).
