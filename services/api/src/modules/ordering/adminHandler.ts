import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { ADMIN_GROUP, isInGroup } from '../../shared/auth/claims.js';
import { AppError } from '../../shared/errors.js';
import {
  errorToProblem,
  json,
  problem,
  validationProblem,
  type HttpResult,
} from '../../shared/http/response.js';
import { logger } from '../../shared/logger.js';
import type { AdvanceOrderStatusInput } from './application/advanceOrderStatus.js';
import type { ListAdminOrdersInput, ListAdminOrdersOutput } from './application/listAdminOrders.js';
import { MAX_PAGE_SIZE } from './domain/history.js';
import type { OrderSummary } from './domain/order.js';

/** Use case của API admin đơn hàng. Lambda admin (PR hạ tầng) truyền bản thật, test truyền mock. */
export interface AdminOrderUseCases {
  listAdminOrders(input: ListAdminOrdersInput): Promise<ListAdminOrdersOutput>;
  advanceOrderStatus(input: AdvanceOrderStatusInput): Promise<OrderSummary>;
}

type Route = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  adminId: string,
  useCases: AdminOrderUseCases,
) => Promise<HttpResult>;

/** Query GET /api/v1/admin/orders theo contracts/openapi.yaml (listAdminOrders) */
const listQuery = z.object({
  status: z.enum(['CONFIRMED', 'SHIPPED'], { error: 'status là CONFIRMED hoặc SHIPPED' }),
  limit: z.coerce
    .number()
    .int('limit là số nguyên')
    .min(1, `limit từ 1 tới ${MAX_PAGE_SIZE}`)
    .max(MAX_PAGE_SIZE, `limit từ 1 tới ${MAX_PAGE_SIZE}`)
    .optional(),
  cursor: z.string().min(1).max(200, 'cursor không hợp lệ').optional(),
});

/** Body PATCH /api/v1/admin/orders/{orderId} theo contracts/openapi.yaml (updateOrderStatus) */
const updateBody = z.strictObject({
  status: z.enum(['SHIPPED', 'DELIVERED'], { error: 'status là SHIPPED hoặc DELIVERED' }),
});

/** Body JSON; sai cú pháp thì trả undefined để báo lỗi 400 như thiếu trường */
function readJson(event: APIGatewayProxyEventV2WithJWTAuthorizer): unknown {
  if (!event.body) return undefined;
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Dữ liệu quản trị: không cache ở CloudFront hay trình duyệt */
function noStore(status: number, body: unknown): HttpResult {
  const result = json(status, body);
  return { ...result, headers: { ...result.headers, 'cache-control': 'no-store' } };
}

/** Bảng route → use case. Khoá trùng route trong contracts/openapi.yaml và HTTP API ở infra/. */
export const adminRoutes: Readonly<Record<string, Route>> = {
  'GET /api/v1/admin/orders': async (event, _adminId, { listAdminOrders }) => {
    const query = listQuery.safeParse(event.queryStringParameters ?? {});
    if (!query.success) return validationProblem(query.error, event.requestContext.requestId);
    // Cursor sai → InvalidOrderCursorError → 400
    return noStore(200, await listAdminOrders(query.data));
  },
  'PATCH /api/v1/admin/orders/{orderId}': async (event, adminId, { advanceOrderStatus }) => {
    const traceId = event.requestContext.requestId;
    const raw = readJson(event);
    if (raw === undefined) {
      return problem({ status: 400, title: 'Bad Request', detail: 'Body phải là JSON', traceId });
    }
    const body = updateBody.safeParse(raw);
    if (!body.success) return validationProblem(body.error, traceId);
    // Sai bước → 409 INVALID_STATUS_TRANSITION; không có đơn hoặc orderId sai dạng → 404
    const orderId = event.pathParameters?.orderId ?? '';
    return noStore(200, await advanceOrderStatus({ adminId, orderId, to: body.data.status }));
  },
};

/**
 * API admin đơn hàng (ordering.md BR-15), chạy ở Lambda riêng chỉ có quyền trên bảng orders.
 * Route gắn JWT authorizer của Cognito nên token đã được kiểm; thiếu `sub` vẫn chặn 401.
 * Không thuộc nhóm `admin` → 403 trước khi đọc bảng (threat model L6, O3): kiểm ở đây, không dựa
 * vào việc giao diện ẩn nút.
 */
export function makeAdminHandler(useCases: AdminOrderUseCases) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<HttpResult> => {
    const traceId = event.requestContext.requestId;
    const claims = event.requestContext.authorizer?.jwt?.claims;
    const sub = claims?.sub;
    if (typeof sub !== 'string' || sub.length === 0) {
      return problem({ status: 401, title: 'Unauthorized', detail: 'Cần đăng nhập', traceId });
    }
    if (!isInGroup(claims, ADMIN_GROUP)) {
      return problem({
        status: 403,
        title: 'Forbidden',
        detail: 'Chỉ quản trị viên được dùng chức năng này',
        code: 'FORBIDDEN',
        traceId,
      });
    }

    const route = adminRoutes[event.routeKey];
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
