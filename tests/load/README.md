# tests/load

Load test bằng k6. An phụ trách.

| File | Dùng khi |
|---|---|
| `smoke.js` | Kịch bản rất nhỏ, chạy mỗi đêm vào staging |
| `tiers.js` | 50, 200 và 1.000 người ảo, chạy tay ở tuần 6 |

Chạy bằng Docker, không cần cài k6:

```bash
docker run --rm -i -e BASE_URL=https://<api-gateway-url> grafana/k6:2.3.0 run - < tests/load/tiers.js
```

- Bắn thẳng vào URL của API Gateway, không qua CloudFront và WAF, để không tiêu hạn mức gói CloudFront Free và không bị rule giới hạn tốc độ chặn.
- Trước khi chạy, xem hạn mức ở Service Quotas → AWS Lambda → Concurrent executions. Gặp throttle thì ghi vào báo cáo.
- Bản đối chứng EC2 (Express + MySQL, `GET /products` và `POST /orders`) chạy bằng Docker Compose trên một máy t3.micro, chỉ bật lúc test rồi xoá.
