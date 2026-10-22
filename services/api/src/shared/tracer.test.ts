import { describe, expect, it, vi } from 'vitest';
import { withTracing, type TracerLike } from './tracer.js';

function fakeTracer(enabled = true) {
  const subsegment = { close: vi.fn() };
  const segment = { addNewSubsegment: vi.fn(() => subsegment) };
  const tracer = {
    isTracingEnabled: vi.fn(() => enabled),
    getSegment: vi.fn(() => segment),
    setSegment: vi.fn(),
    annotateColdStart: vi.fn(),
    addServiceNameAnnotation: vi.fn(),
    putAnnotation: vi.fn(),
    addErrorAsMetadata: vi.fn(),
  };
  return { tracer: tracer as unknown as TracerLike, raw: tracer, segment, subsegment };
}

const event = { routeKey: 'GET /api/v1/products' };

describe('withTracing', () => {
  it('withTracing_annotatesRouteAndStatus_andClosesSubsegment_whenHandlerSucceeds', async () => {
    // Arrange
    const { tracer, raw, segment, subsegment } = fakeTracer();
    const handler = withTracing(async () => ({ statusCode: 200, body: '[]' }), tracer);

    // Act
    const result = await handler(event);

    // Assert
    expect(result).toEqual({ statusCode: 200, body: '[]' });
    expect(raw.setSegment).toHaveBeenNthCalledWith(1, subsegment);
    expect(raw.annotateColdStart).toHaveBeenCalledOnce();
    expect(raw.addServiceNameAnnotation).toHaveBeenCalledOnce();
    expect(raw.putAnnotation).toHaveBeenCalledWith('routeKey', 'GET /api/v1/products');
    expect(raw.putAnnotation).toHaveBeenCalledWith('statusCode', 200);
    expect(subsegment.close).toHaveBeenCalledOnce();
    expect(raw.setSegment).toHaveBeenLastCalledWith(segment);
  });

  it('withTracing_recordsErrorAndRethrows_whenHandlerThrows', async () => {
    // Arrange
    const { tracer, raw, subsegment } = fakeTracer();
    const error = new Error('DynamoDB tạm lỗi');
    const handler = withTracing(async () => {
      throw error;
    }, tracer);

    // Act + Assert
    await expect(handler(event)).rejects.toBe(error);
    expect(raw.addErrorAsMetadata).toHaveBeenCalledWith(error);
    expect(subsegment.close).toHaveBeenCalledOnce();
  });

  it('withTracing_callsHandlerOnly_whenTracingDisabled', async () => {
    // Arrange: chạy ở máy hoặc trong test thì không có X-Ray
    const { tracer, raw } = fakeTracer(false);
    const inner = vi.fn(async () => ({ statusCode: 204 }));
    const handler = withTracing(inner, tracer);

    // Act
    const result = await handler(event);

    // Assert
    expect(result).toEqual({ statusCode: 204 });
    expect(inner).toHaveBeenCalledWith(event, undefined);
    expect(raw.getSegment).not.toHaveBeenCalled();
  });

  it('withTracing_skipsRouteAnnotation_whenEventHasNoRouteKey', async () => {
    // Arrange: event của Cognito trigger không có routeKey
    const { tracer, raw } = fakeTracer();
    const handler = withTracing(async (e: { userPoolId: string }) => e, tracer);

    // Act
    await handler({ userPoolId: 'pool-1' });

    // Assert
    expect(raw.putAnnotation).not.toHaveBeenCalledWith('routeKey', expect.anything());
  });
});
