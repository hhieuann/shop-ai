import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { json, problem, validationProblem, type HttpResult } from '../../shared/http/response.js';
import type { ListOptions } from './application/getRecs.js';
import {
  DEFAULT_LIMIT,
  MAX_EXCLUDE,
  MAX_LIMIT,
  REC_CATEGORIES,
  type RecsResult,
} from './domain/recs.js';

/** Use case mà handler cần. lambda.ts truyền bản thật, test truyền mock. */
export interface RecsUseCases {
  getAlsoBought(input: ListOptions & { readonly productId: string }): Promise<RecsResult>;
  getForYou(input: ListOptions & { readonly userId: string }): Promise<RecsResult>;
  getBestsellers(input: ListOptions & { readonly category?: string }): Promise<RecsResult>;
}

type Route = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  /** Chỉ có ở route gắn JWT authorizer (for-you); route công khai luôn là undefined */
  userId: string | undefined,
  useCases: RecsUseCases,
) => Promise<HttpResult>;

/** Cùng quy tắc với catalog, cart (routes.ts của hai module đó) */
const productId = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,64}$/, 'productId chỉ gồm chữ, số và dấu gạch ngang, tối đa 64 ký tự');

/** RecsLimit: 1–10, mặc định 6 */
const limit = z.coerce
  .number({ error: `limit là số nguyên từ 1 tới ${MAX_LIMIT}` })
  .int(`limit là số nguyên từ 1 tới ${MAX_LIMIT}`)
  .min(1, `limit từ 1 tới ${MAX_LIMIT}`)
  .max(MAX_LIMIT, `limit từ 1 tới ${MAX_LIMIT}`)
  .default(DEFAULT_LIMIT);

/** RecsExclude: `exclude=a,b,c` (style form, explode false), tối đa 20 mã */
const exclude = z
  .string()
  .optional()
  .transform((raw) => (raw ?? '').split(',').filter((id) => id !== ''))
  .pipe(z.array(productId).max(MAX_EXCLUDE, `exclude tối đa ${MAX_EXCLUDE} mã`));

const listQuery = z.object({ exclude, limit });
const alsoBoughtQuery = listQuery.extend({ productId });
const bestsellersQuery = listQuery.extend({ category: z.enum(REC_CATEGORIES).optional() });

/** Gợi ý theo người dùng là dữ liệu riêng: không cache ở CloudFront hay trình duyệt */
function privateResponse(result: RecsResult): HttpResult {
  const res = json(200, result);
  return { ...res, headers: { ...res.headers, 'cache-control': 'no-store' } };
}

/** Bảng route → use case. Khoá trùng route trong contracts/openapi.yaml và HTTP API ở infra/. */
export const routes: Readonly<Record<string, Route>> = {
  'GET /api/v1/recs/also-bought': async (event, _userId, { getAlsoBought }) => {
    const query = alsoBoughtQuery.safeParse(event.queryStringParameters ?? {});
    if (!query.success) return validationProblem(query.error, event.requestContext.requestId);
    return json(200, await getAlsoBought(query.data));
  },

  'GET /api/v1/recs/for-you': async (event, userId, { getForYou }) => {
    // Route gắn JWT authorizer nên luôn có userId; thiếu thì vẫn chặn 401 cho chắc
    if (userId === undefined) {
      return problem({
        status: 401,
        title: 'Unauthorized',
        detail: 'Cần đăng nhập',
        traceId: event.requestContext.requestId,
      });
    }
    const query = listQuery.safeParse(event.queryStringParameters ?? {});
    if (!query.success) return validationProblem(query.error, event.requestContext.requestId);
    return privateResponse(await getForYou({ userId, ...query.data }));
  },

  'GET /api/v1/recs/bestsellers': async (event, _userId, { getBestsellers }) => {
    const query = bestsellersQuery.safeParse(event.queryStringParameters ?? {});
    if (!query.success) return validationProblem(query.error, event.requestContext.requestId);
    const { category, ...options } = query.data;
    return json(
      200,
      await getBestsellers(category === undefined ? options : { ...options, category }),
    );
  },
};
