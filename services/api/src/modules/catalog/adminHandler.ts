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
import type { ListAdminProductsInput } from './application/listAdminProducts.js';
import { ADMIN_PRODUCT_GROUPS, type AdminProductPage } from './domain/adminProduct.js';
import { MAX_PAGE_SIZE } from './domain/listing.js';
import { PRODUCT_CATEGORIES, type Product } from './domain/product.js';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from './domain/search.js';

/** Use case của API admin sản phẩm. adminLambda.ts truyền bản thật, test truyền mock. */
export interface AdminProductUseCases {
  listAdminProducts(input: ListAdminProductsInput): Promise<AdminProductPage>;
  getAdminProduct(input: { readonly productId: string }): Promise<Product>;
}

type Route = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  adminId: string,
  useCases: AdminProductUseCases,
) => Promise<HttpResult>;

/** Query GET /api/v1/admin/products theo contracts/openapi.yaml (listAdminProducts, catalog.md BR-10) */
const listQuery = z.object({
  category: z.enum(PRODUCT_CATEGORIES, { error: 'category là một trong 13 loại hàng' }),
  status: z
    .enum(ADMIN_PRODUCT_GROUPS, { error: 'status là ACTIVE, INACTIVE hoặc DELETED' })
    .optional(),
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `q dài ${SEARCH_MIN_LENGTH}–${SEARCH_MAX_LENGTH} ký tự`)
    .max(SEARCH_MAX_LENGTH, `q dài ${SEARCH_MIN_LENGTH}–${SEARCH_MAX_LENGTH} ký tự`)
    .optional(),
  limit: z.coerce
    .number()
    .int('limit là số nguyên')
    .min(1, `limit từ 1 tới ${MAX_PAGE_SIZE}`)
    .max(MAX_PAGE_SIZE, `limit từ 1 tới ${MAX_PAGE_SIZE}`)
    .optional(),
  cursor: z.string().min(1).max(200, 'cursor không hợp lệ').optional(),
});

/** Như route chi tiết của khách (routes.ts): sai dạng thì 400 */
const productParams = z.object({
  productId: z
    .string()
    .regex(/^[A-Za-z0-9-]{1,64}$/, 'productId chỉ gồm chữ, số và dấu gạch ngang, tối đa 64 ký tự'),
});

/** Dữ liệu quản trị: không cache ở CloudFront hay trình duyệt (catalog.md BR-09) */
function noStore(status: number, body: unknown): HttpResult {
  const result = json(status, body);
  return { ...result, headers: { ...result.headers, 'cache-control': 'no-store' } };
}

/** Bảng route → use case. Khoá trùng route trong contracts/openapi.yaml và HTTP API ở infra/. */
export const adminProductRoutes: Readonly<Record<string, Route>> = {
  'GET /api/v1/admin/products': async (event, _adminId, { listAdminProducts }) => {
    const query = listQuery.safeParse(event.queryStringParameters ?? {});
    if (!query.success) return validationProblem(query.error, event.requestContext.requestId);
    // Cursor sai → InvalidCursorError → 400
    return noStore(200, await listAdminProducts(query.data));
  },
  'GET /api/v1/admin/products/{productId}': async (event, _adminId, { getAdminProduct }) => {
    const params = productParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, event.requestContext.requestId);
    // Không có → ProductNotFoundError → 404; món đã ẩn, đã xoá vẫn trả (có deletedAt)
    return noStore(200, await getAdminProduct({ productId: params.data.productId }));
  },
};

/**
 * API admin sản phẩm (catalog.md BR-09 … BR-15), chạy ở Lambda riêng (adminLambda.ts).
 * Route gắn JWT authorizer của Cognito nên token đã được kiểm; thiếu `sub` vẫn chặn 401.
 * Không thuộc nhóm `admin` → 403 trước khi đọc bảng: kiểm ở đây, không dựa vào giao diện.
 */
export function makeAdminProductHandler(useCases: AdminProductUseCases) {
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

    const route = adminProductRoutes[event.routeKey];
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
