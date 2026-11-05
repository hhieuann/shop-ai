import { MetricUnit, type Metrics } from '@aws-lambda-powertools/metrics';
import type { EmailMetrics, EmailRejectedReason, OrderMetrics } from '../ports.js';

/**
 * Metric nghiệp vụ của ordering qua Powertools Metrics (ghi định dạng EMF vào log, CloudWatch tự
 * tách thành metric). Namespace lấy từ POWERTOOLS_METRICS_NAMESPACE (tiền tố stack, vd. shop-prd)
 * để dev, staging, prod chung tài khoản không lẫn số; alarm ở infra/lib/monitoring.ts chỉ ở prod.
 */
export class PowertoolsOrderMetrics implements OrderMetrics, EmailMetrics {
  constructor(private readonly metrics: Metrics) {}

  /** Thư không gửi được mà thử lại vô ích (worker); không có alarm, xem trên CloudWatch theo `reason` */
  emailRejected(reason: EmailRejectedReason): void {
    const single = this.metrics.singleMetric();
    single.addDimension('reason', reason);
    single.addMetric('OrderEmailRejected', MetricUnit.Count, 1);
  }

  enqueueFailed(): void {
    this.metrics.addMetric('OrderEnqueueFailed', MetricUnit.Count, 1);
    // Ghi ngay, không chờ cuối request: lỗi này hiếm và cần thấy kể cả khi request lỗi tiếp sau đó
    this.metrics.publishStoredMetrics();
  }
}
