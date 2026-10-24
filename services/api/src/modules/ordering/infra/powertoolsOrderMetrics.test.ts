import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { describe, expect, it, vi } from 'vitest';
import { PowertoolsOrderMetrics } from './powertoolsOrderMetrics.js';

describe('PowertoolsOrderMetrics', () => {
  it('enqueueFailed_addsCountAndPublishesImmediately', () => {
    // Arrange
    const metrics = { addMetric: vi.fn(), publishStoredMetrics: vi.fn() };
    const adapter = new PowertoolsOrderMetrics(metrics as never);

    // Act
    adapter.enqueueFailed();

    // Assert: tên metric khớp alarm ở infra/lib/monitoring.ts
    expect(metrics.addMetric).toHaveBeenCalledExactlyOnceWith(
      'OrderEnqueueFailed',
      MetricUnit.Count,
      1,
    );

    // Verify
    expect(metrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });
});
