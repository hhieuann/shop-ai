import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { AppError } from '../../shared/errors.js';
import { errorToProblem, problem, type HttpResult } from '../../shared/http/response.js';
import { logger } from '../../shared/logger.js';
import { routes, type RecsUseCases } from './routes.js';

/**
 * Nhận request từ HTTP API, chọn route, đổi lỗi sang HTTP.
 * `also-bought`, `bestsellers` công khai; chỉ `for-you` gắn JWT authorizer của Cognito
 * (infra/lib/api-stack.ts), nên `sub` chỉ có ở route đó.
 */
export function makeHandler(useCases: RecsUseCases) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<HttpResult> => {
    const traceId = event.requestContext.requestId;
    const route = routes[event.routeKey];
    if (!route) {
      return problem({
        status: 404,
        title: 'Not Found',
        detail: `Không có route ${event.routeKey}`,
        traceId,
      });
    }

    const sub: unknown = event.requestContext.authorizer?.jwt?.claims?.sub;
    const userId = typeof sub === 'string' && sub.length > 0 ? sub : undefined;
    try {
      return await route(event, userId, useCases);
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('Lỗi không lường trước', { error, traceId, routeKey: event.routeKey });
      }
      return errorToProblem(error, traceId);
    }
  };
}
