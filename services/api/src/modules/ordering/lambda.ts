import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { problem, type HttpResult } from '../../shared/http/response.js';
import { withTracing } from '../../shared/tracer.js';

// Tạm thời: hạ tầng ordering lên dev trước (#228), 4 route trả 501 tới khi có use case thật
// (#229 tạo đơn, #230 xem đơn, #231 huỷ đơn). CDK trỏ Lambda vào file này.
export const handler = withTracing(
  async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<HttpResult> =>
    problem({
      status: 501,
      title: 'Not Implemented',
      detail: `Route ${event.routeKey} chưa có`,
      traceId: event.requestContext.requestId,
    }),
);
