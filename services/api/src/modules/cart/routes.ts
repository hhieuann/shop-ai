import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { json, problem, validationProblem, type HttpResult } from '../../shared/http/response.js';
import { MAX_QUANTITY, type CartView } from './domain/cart.js';

/** Use case mà handler cần. lambda.ts truyền bản thật, test truyền mock. */
export interface CartUseCases {
  getCart(input: { readonly userId: string }): Promise<CartView>;
  addCartItem(input: {
    readonly userId: string;
    readonly productId: string;
    readonly quantity: number;
  }): Promise<CartView>;
  updateCartItem(input: {
    readonly userId: string;
    readonly productId: string;
    readonly quantity: number;
  }): Promise<CartView>;
  removeCartItem(input: { readonly userId: string; readonly productId: string }): Promise<CartView>;
}

type Route = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  userId: string,
  useCases: CartUseCases,
) => Promise<HttpResult>;

/** Cùng quy tắc với catalog (routes.ts của catalog) */
const productId = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,64}$/, 'productId chỉ gồm chữ, số và dấu gạch ngang, tối đa 64 ký tự');

const quantity = z
  .number({ error: 'quantity là số nguyên' })
  .int('quantity là số nguyên')
  .min(1, `quantity từ 1 tới ${MAX_QUANTITY}`)
  .max(MAX_QUANTITY, `quantity từ 1 tới ${MAX_QUANTITY}`);

const itemParams = z.object({ productId });
const addBody = z.object({ productId, quantity });
const updateBody = z.object({ quantity });

/** Body JSON; sai cú pháp thì trả undefined để zod báo lỗi 400 như thiếu trường */
function readJson(event: APIGatewayProxyEventV2WithJWTAuthorizer): unknown {
  if (!event.body) return undefined;
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Giỏ là dữ liệu riêng của từng người: không cache ở CloudFront hay trình duyệt */
function cartResponse(view: CartView): HttpResult {
  const result = json(200, view);
  return { ...result, headers: { ...result.headers, 'cache-control': 'no-store' } };
}

function badBody(event: APIGatewayProxyEventV2WithJWTAuthorizer): HttpResult {
  return problem({
    status: 400,
    title: 'Bad Request',
    detail: 'Body phải là JSON',
    traceId: event.requestContext.requestId,
  });
}

/** Bảng route → use case. Khoá trùng route trong contracts/openapi.yaml và HTTP API ở infra/. */
export const routes: Readonly<Record<string, Route>> = {
  'GET /api/v1/cart': async (_event, userId, { getCart }) =>
    cartResponse(await getCart({ userId })),

  'POST /api/v1/cart/items': async (event, userId, { addCartItem }) => {
    const raw = readJson(event);
    if (raw === undefined) return badBody(event);
    const body = addBody.safeParse(raw);
    if (!body.success) return validationProblem(body.error, event.requestContext.requestId);
    return cartResponse(await addCartItem({ userId, ...body.data }));
  },

  'PUT /api/v1/cart/items/{productId}': async (event, userId, { updateCartItem }) => {
    const params = itemParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, event.requestContext.requestId);
    const raw = readJson(event);
    if (raw === undefined) return badBody(event);
    const body = updateBody.safeParse(raw);
    if (!body.success) return validationProblem(body.error, event.requestContext.requestId);
    return cartResponse(
      await updateCartItem({ userId, productId: params.data.productId, ...body.data }),
    );
  },

  'DELETE /api/v1/cart/items/{productId}': async (event, userId, { removeCartItem }) => {
    const params = itemParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, event.requestContext.requestId);
    return cartResponse(await removeCartItem({ userId, productId: params.data.productId }));
  },
};
