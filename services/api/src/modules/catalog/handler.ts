import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AppError } from '../../shared/errors.js';
import { errorToProblem, problem, type HttpResult } from '../../shared/http/response.js';
import { logger } from '../../shared/logger.js';
import { routes, type CatalogUseCases } from './routes.js';

/** Nhận request từ HTTP API, chọn route, đổi lỗi sang HTTP. Use case truyền từ ngoài vào nên test không cần AWS. */
export function makeHandler(useCases: CatalogUseCases) {
  return async (event: APIGatewayProxyEventV2): Promise<HttpResult> => {
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

    try {
      return await route(event, useCases);
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('Lỗi không lường trước', { error, traceId, routeKey: event.routeKey });
      }
      return errorToProblem(error, traceId);
    }
  };
}
