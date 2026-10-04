import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z } from 'zod';
import { json, validationProblem, type HttpResult } from '../../shared/http/response.js';
import type { ListProductsInput } from './application/listProducts.js';
import { MAX_PAGE_SIZE, PRODUCT_SORTS, type Page } from './domain/listing.js';
import { PRODUCT_CATEGORIES, type Product, type ProductSummary } from './domain/product.js';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from './domain/search.js';

/** Use case mà handler cần. lambda.ts truyền bản thật, test truyền mock. */
export interface CatalogUseCases {
  getProduct(input: { readonly productId: string }): Promise<Product>;
  listProducts(input: ListProductsInput): Promise<Page<ProductSummary>>;
}

type Route = (event: APIGatewayProxyEventV2, useCases: CatalogUseCases) => Promise<HttpResult>;

const productParams = z.object({
  productId: z
    .string()
    .regex(/^[A-Za-z0-9-]{1,64}$/, 'productId chỉ gồm chữ, số và dấu gạch ngang, tối đa 64 ký tự'),
});

/** Query string của GET /api/v1/products, khớp contracts/openapi.yaml (catalog.md BR-01, BR-03, BR-08). */
const listQuery = z.object({
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `q dài ${SEARCH_MIN_LENGTH}–${SEARCH_MAX_LENGTH} ký tự`)
    .max(SEARCH_MAX_LENGTH, `q dài ${SEARCH_MIN_LENGTH}–${SEARCH_MAX_LENGTH} ký tự`)
    .optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  sort: z.enum(PRODUCT_SORTS).optional(),
  limit: z.coerce
    .number()
    .int('limit là số nguyên')
    .min(1, `limit từ 1 tới ${MAX_PAGE_SIZE}`)
    .max(MAX_PAGE_SIZE, `limit từ 1 tới ${MAX_PAGE_SIZE}`)
    .optional(),
  cursor: z.string().min(1).max(200, 'cursor không hợp lệ').optional(),
});

/** Bảng route → use case. Khoá trùng route trong contracts/openapi.yaml và HTTP API ở infra/. */
export const routes: Readonly<Record<string, Route>> = {
  'GET /api/v1/products': async (event, { listProducts }) => {
    const query = listQuery.safeParse(event.queryStringParameters ?? {});
    if (!query.success) return validationProblem(query.error, event.requestContext.requestId);
    return json(200, await listProducts(query.data));
  },

  'GET /api/v1/products/{productId}': async (event, { getProduct }) => {
    const params = productParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, event.requestContext.requestId);
    return json(200, await getProduct({ productId: params.data.productId }));
  },
};
