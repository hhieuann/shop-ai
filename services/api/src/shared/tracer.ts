import { Tracer } from '@aws-lambda-powertools/tracer';
import type { Context } from 'aws-lambda';

/**
 * X-Ray cho mọi Lambda API. CDK bật `Tracing.ACTIVE`; tên service lấy từ POWERTOOLS_SERVICE_NAME.
 * Ngoài Lambda (máy cá nhân, test) Powertools tự tắt tracing.
 */
export const tracer = new Tracer();

export type TracerLike = Pick<
  Tracer,
  | 'isTracingEnabled'
  | 'getSegment'
  | 'setSegment'
  | 'annotateColdStart'
  | 'addServiceNameAnnotation'
  | 'putAnnotation'
  | 'addErrorAsMetadata'
>;

/** Bọc client AWS SDK v3 để mỗi lần gọi DynamoDB, Cognito... thành một subsegment trên X-Ray. */
export function captureClient<T>(client: T): T {
  return tracer.captureAWSv3Client(client);
}

/**
 * Bọc handler: tạo subsegment `## handler`, gắn annotation cold start, service, routeKey, statusCode
 * để lọc trace trên console (vd. `annotation.statusCode >= 500`).
 * Không ghi response vào trace: có thể chứa dữ liệu cá nhân và vượt giới hạn 64 KB của segment.
 */
export function withTracing<E, R>(
  handler: (event: E, context?: Context) => Promise<R>,
  t: TracerLike = tracer,
): (event: E, context?: Context) => Promise<R> {
  return async (event, context) => {
    if (!t.isTracingEnabled()) return handler(event, context);

    const segment = t.getSegment();
    const subsegment = segment?.addNewSubsegment('## handler');
    if (subsegment) t.setSegment(subsegment);
    t.annotateColdStart();
    t.addServiceNameAnnotation();
    const routeKey = (event as { routeKey?: unknown }).routeKey;
    if (typeof routeKey === 'string') t.putAnnotation('routeKey', routeKey);

    try {
      const result = await handler(event, context);
      const statusCode = (result as { statusCode?: unknown } | undefined)?.statusCode;
      if (typeof statusCode === 'number') t.putAnnotation('statusCode', statusCode);
      return result;
    } catch (error) {
      if (error instanceof Error) t.addErrorAsMetadata(error);
      throw error;
    } finally {
      subsegment?.close();
      if (segment) t.setSegment(segment);
    }
  };
}
