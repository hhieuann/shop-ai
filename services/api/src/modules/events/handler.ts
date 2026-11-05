import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { errorToProblem, problem, type HttpResult } from '../../shared/http/response.js';
import { logger } from '../../shared/logger.js';
import { routes, type EventUseCases } from './routes.js';

/**
 * Nhận request từ HTTP API, lấy userId từ token, chọn route, đổi lỗi sang HTTP.
 * Route gắn JWT authorizer của Cognito nên token đã được kiểm; thiếu `sub` thì vẫn chặn 401.
 * Không log userId, body hay bản băm kèm thông tin định danh khác (events.md mục 5).
 */
export function makeHandler(useCases: EventUseCases) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<HttpResult> => {
    const traceId = event.requestContext.requestId;
    const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
    if (typeof sub !== 'string' || sub.length === 0) {
      return problem({ status: 401, title: 'Unauthorized', detail: 'Cần đăng nhập', traceId });
    }

    const route = routes[event.routeKey];
    if (!route) {
      return problem({
        status: 404,
        title: 'Not Found',
        detail: `Không có route ${event.routeKey}`,
        traceId,
      });
    }

    try {
      return await route(event, sub, useCases);
    } catch (error) {
      logger.error('Không ghi được sự kiện', { error, traceId, routeKey: event.routeKey });
      return errorToProblem(error, traceId);
    }
  };
}
