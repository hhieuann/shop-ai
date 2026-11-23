import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ORDERING_METRICS_SERVICE,
  orderingMetrics,
  PowertoolsOrderMetrics,
} from './powertoolsOrderMetrics.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it('emailRejected_emitsSingleMetricWithReasonDimension', () => {
    // Arrange: metric riêng để dimension reason không dính vào metric khác của lần chạy
    const single = { addDimension: vi.fn(), addMetric: vi.fn() };
    const metrics = { singleMetric: vi.fn(() => single) };
    const adapter = new PowertoolsOrderMetrics(metrics as never);

    // Act
    adapter.emailRejected('not_verified');

    // Assert
    expect(single.addDimension).toHaveBeenCalledExactlyOnceWith('reason', 'not_verified');
    expect(single.addMetric).toHaveBeenCalledExactlyOnceWith(
      'OrderEmailRejected',
      MetricUnit.Count,
      1,
    );
  });
});

describe('orderingMetrics', () => {
  it('orderingMetrics_tagsServiceOrdering_evenWhenLambdaServiceNameDiffers', () => {
    // Arrange: Lambda admin đặt POWERTOOLS_SERVICE_NAME riêng cho log, trace
    vi.stubEnv('POWERTOOLS_SERVICE_NAME', 'ordering-admin');
    vi.stubEnv('POWERTOOLS_METRICS_NAMESPACE', 'shop-test');
    const metrics = orderingMetrics();

    // Act
    metrics.addMetric('OrderEnqueueFailed', MetricUnit.Count, 1);
    const emf = metrics.serializeMetrics();

    // Assert: alarm order-enqueue-failed (infra/lib/monitoring.ts) lọc dimension service=ordering
    expect(ORDERING_METRICS_SERVICE).toBe('ordering');
    expect(emf).toMatchObject({ service: 'ordering', OrderEnqueueFailed: 1 });
    expect(emf._aws.CloudWatchMetrics[0]?.Namespace).toBe('shop-test');
    expect(emf._aws.CloudWatchMetrics[0]?.Dimensions).toEqual([['service']]);
  });
});
