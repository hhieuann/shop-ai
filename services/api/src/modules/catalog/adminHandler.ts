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
import type { ProductImageUploadResult } from './application/createProductImageUpload.js';
import type { ListAdminProductsInput } from './application/listAdminProducts.js';
import type { UpdateAdminProductInput } from './application/updateAdminProduct.js';
import {
  ADMIN_PRODUCT_GROUPS,
  type AdminProductDraft,
  type AdminProductPage,
} from './domain/adminProduct.js';
import { MAX_PAGE_SIZE } from './domain/listing.js';
import {
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  type ImageContentType,
} from './domain/productImage.js';
import { PRODUCT_CATEGORIES, type Product } from './domain/product.js';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from './domain/search.js';

/** Use case của API admin sản phẩm. adminLambda.ts truyền bản thật, test truyền mock. */
export interface AdminProductUseCases {
  listAdminProducts(input: ListAdminProductsInput): Promise<AdminProductPage>;
  getAdminProduct(input: { readonly productId: string }): Promise<Product>;
  createAdminProduct(input: {
    readonly adminId: string;
    readonly draft: AdminProductDraft;
  }): Promise<Product>;
  updateAdminProduct(input: UpdateAdminProductInput): Promise<Product>;
  deleteAdminProduct(input: {
    readonly adminId: string;
    readonly productId: string;
  }): Promise<void>;
  restoreAdminProduct(input: {
    readonly adminId: string;
    readonly productId: string;
  }): Promise<Product>;
  createProductImageUpload(input: {
    readonly adminId: string;
    readonly contentType: ImageContentType;
  }): Promise<ProductImageUploadResult>;
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

// ─── Body thêm, sửa (contracts/openapi.yaml AdminProductCreate, AdminProductUpdate; BR-11, BR-12) ───
// Chuỗi bỏ khoảng trắng hai đầu trước khi kiểm độ dài. Khoá thông số theo loại kiểm ở use case.

const text = (field: string, max: number) =>
  z
    .string({ error: `${field} là chuỗi` })
    .trim()
    .min(1, `${field} dài 1–${max} ký tự`)
    .max(max, `${field} dài 1–${max} ký tự`);
const price = z
  .number({ error: 'price là số' })
  .int('price là số nguyên')
  .min(1, 'price từ 1 tới 1.000.000.000')
  .max(1_000_000_000, 'price từ 1 tới 1.000.000.000');
const stock = (field: string) =>
  z
    .number({ error: `${field} là số` })
    .int(`${field} là số nguyên`)
    .min(0, `${field} từ 0 tới 9999`)
    .max(9999, `${field} từ 0 tới 9999`);
const imageUrl = z
  .string({ error: 'imageUrl là chuỗi' })
  .trim()
  .max(500, 'imageUrl tối đa 500 ký tự')
  // Ảnh tải lên (BR-16) cũng là https đầy đủ: https://<tên miền shop>/images/products/<ULID>.<đuôi>
  .regex(/^https:\/\/\S+$/, 'imageUrl là đường dẫn https://');
const specs = z
  .record(
    z.string().regex(/^[a-z0-9_]{1,40}$/, 'khoá thông số chỉ gồm a-z, 0-9, _'),
    z
      .string({ error: 'giá trị thông số là chuỗi' })
      .trim()
      .min(1, 'giá trị thông số dài 1–100 ký tự')
      .max(100, 'giá trị thông số dài 1–100 ký tự'),
  )
  .refine((value) => Object.keys(value).length <= 20, 'specs tối đa 20 cặp');
const status = z.enum(['ACTIVE', 'INACTIVE'], { error: 'status là ACTIVE hoặc INACTIVE' });

const createBody = z.strictObject({
  name: text('name', 150),
  category: z.enum(PRODUCT_CATEGORIES, { error: 'category là một trong 13 loại hàng' }),
  brand: text('brand', 50),
  price,
  stock: stock('stock'),
  status,
  description: text('description', 1000),
  imageUrl: imageUrl.optional(),
  specs: specs.optional(),
});

const updateBody = z
  .strictObject({
    updatedAt: z.iso.datetime({ error: 'updatedAt là thời điểm ISO 8601' }),
    name: text('name', 150).optional(),
    brand: text('brand', 50).optional(),
    price: price.optional(),
    stock: stock('stock').optional(),
    expectedStock: stock('expectedStock').optional(),
    status: status.optional(),
    description: text('description', 1000).optional(),
    imageUrl: imageUrl.nullable().optional(),
    specs: specs.optional(),
  })
  .refine((body) => body.stock === undefined || body.expectedStock !== undefined, {
    message: 'Có stock thì phải gửi expectedStock',
    path: ['expectedStock'],
  })
  .refine((body) => Object.keys(body).some((k) => k !== 'updatedAt' && k !== 'expectedStock'), {
    message: 'Gửi ít nhất một trường cần sửa',
    path: [],
  });

/** Body POST /api/v1/admin/product-images (catalog.md BR-16): loại và cỡ tệp định tải lên */
const imageUploadBody = z.strictObject({
  contentType: z.enum(IMAGE_CONTENT_TYPES, {
    error: 'contentType là image/jpeg, image/png hoặc image/webp',
  }),
  size: z
    .number({ error: 'size là số byte' })
    .int('size là số nguyên')
    .min(1, 'Tệp rỗng')
    .max(MAX_IMAGE_BYTES, 'Ảnh tối đa 3 MB'),
});

/** Body JSON; sai cú pháp thì trả undefined để báo lỗi 400 (như ordering/adminHandler.ts) */
function readJson(event: APIGatewayProxyEventV2WithJWTAuthorizer): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function notJson(traceId: string): HttpResult {
  return problem({ status: 400, title: 'Bad Request', detail: 'Body phải là JSON', traceId });
}

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
  'POST /api/v1/admin/products': async (event, adminId, { createAdminProduct }) => {
    const traceId = event.requestContext.requestId;
    const raw = readJson(event);
    if (raw === undefined) return notJson(traceId);
    const body = createBody.safeParse(raw);
    if (!body.success) return validationProblem(body.error, traceId);
    // Khoá thông số không thuộc loại → InvalidSpecKeysError → 400
    const product = await createAdminProduct({ adminId, draft: body.data });
    const result = noStore(201, product);
    return {
      ...result,
      headers: { ...result.headers, location: `/api/v1/admin/products/${product.productId}` },
    };
  },
  'PATCH /api/v1/admin/products/{productId}': async (event, adminId, { updateAdminProduct }) => {
    const traceId = event.requestContext.requestId;
    const params = productParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, traceId);
    const raw = readJson(event);
    if (raw === undefined) return notJson(traceId);
    const body = updateBody.safeParse(raw);
    if (!body.success) return validationProblem(body.error, traceId);
    const { updatedAt, expectedStock, ...patch } = body.data;
    // Đã xoá hoặc không có → 404; lệch updatedAt → 409 PRODUCT_CHANGED; lệch tồn kho → 409 STOCK_CHANGED
    const product = await updateAdminProduct({
      adminId,
      productId: params.data.productId,
      patch,
      updatedAt,
      ...(expectedStock !== undefined && { expectedStock }),
    });
    return noStore(200, product);
  },
  'DELETE /api/v1/admin/products/{productId}': async (event, adminId, { deleteAdminProduct }) => {
    const params = productParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, event.requestContext.requestId);
    await deleteAdminProduct({ adminId, productId: params.data.productId });
    return { statusCode: 204, headers: { 'cache-control': 'no-store' } };
  },
  'POST /api/v1/admin/products/{productId}/restore': async (
    event,
    adminId,
    { restoreAdminProduct },
  ) => {
    const params = productParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, event.requestContext.requestId);
    // Không có hoặc chưa xoá → 404
    return noStore(200, await restoreAdminProduct({ adminId, productId: params.data.productId }));
  },
  'POST /api/v1/admin/product-images': async (event, adminId, { createProductImageUpload }) => {
    const traceId = event.requestContext.requestId;
    const raw = readJson(event);
    if (raw === undefined) return notJson(traceId);
    const body = imageUploadBody.safeParse(raw);
    if (!body.success) return validationProblem(body.error, traceId);
    // Cỡ chỉ dùng để từ chối sớm; S3 tự chặn theo điều kiện ký kèm vé (1 B … 3 MB)
    return noStore(
      200,
      await createProductImageUpload({ adminId, contentType: body.data.contentType }),
    );
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
