import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { AppError } from '../../shared/errors.js';
import { errorToProblem, problem, type HttpResult } from '../../shared/http/response.js';
import { logger } from '../../shared/logger.js';
import { routes, type CartUseCases } from './routes.js';

/**
 * Nhận request từ HTTP API, lấy userId từ token, chọn route, đổi lỗi sang HTTP.
 * Mọi route của cart gắn JWT authorizer của Cognito (infra/lib/api-stack.ts), nên tới đây
 * token đã được kiểm chữ ký và hạn dùng; thiếu `sub` thì vẫn chặn 401 cho chắc.
 */
export function makeHandler(useCases: CartUseCases) {
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
      if (!(error instanceof AppError)) {
        logger.error('Lỗi không lường trước', { error, traceId, routeKey: event.routeKey });
      }
      return errorToProblem(error, traceId);
    }
  };
}
