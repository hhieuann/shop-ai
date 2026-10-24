import type { APIGatewayProxyEventV2WithJWTAuthorizer, Context } from 'aws-lambda';
import { z } from 'zod';
import { json, problem, validationProblem, type HttpResult } from '../../shared/http/response.js';
import { parseIdempotencyKey } from '../../shared/idempotency.js';
import type { PlaceOrderOutput } from './application/placeOrder.js';
import {
  MAX_LINES,
  MAX_QUANTITY,
  type RequestedItem,
  type ShippingAddress,
} from './domain/order.js';

/** Use case mà handler cần. lambda.ts truyền bản thật, test truyền mock. */
export interface OrderingUseCases {
  /** Đã bọc chống tạo đơn hai lần (shared/idempotency); replayed = trả lại kết quả lần trước */
  placeOrder(
    input: {
      readonly userId: string;
      readonly idempotencyKey: string;
      readonly correlationId: string;
      readonly items: readonly RequestedItem[];
      readonly shippingAddress: ShippingAddress;
    },
    context?: Context,
  ): Promise<{ readonly value: PlaceOrderOutput; readonly replayed: boolean }>;
}

type Route = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  userId: string,
  useCases: OrderingUseCases,
  context?: Context,
) => Promise<HttpResult>;

/** Cùng quy tắc với catalog, cart */
const productId = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,64}$/, 'productId chỉ gồm chữ, số và dấu gạch ngang, tối đa 64 ký tự');

/** Body POST /api/v1/orders theo contracts/openapi.yaml (createOrder, ShippingAddress) */
const createOrderBody = z.object({
  items: z
    .array(
      z.object({
        productId,
        quantity: z
          .number({ error: 'quantity là số nguyên' })
          .int('quantity là số nguyên')
          .min(1, `quantity từ 1 tới ${MAX_QUANTITY}`)
          .max(MAX_QUANTITY, `quantity từ 1 tới ${MAX_QUANTITY}`),
        expectedPrice: z
          .number({ error: 'expectedPrice là số nguyên' })
          .int('expectedPrice là số nguyên')
          .nonnegative('expectedPrice không âm'),
      }),
    )
    .min(1, 'items cần ít nhất 1 món')
    .max(MAX_LINES, `items tối đa ${MAX_LINES} món`)
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      'items có productId trùng nhau',
    ),
  shippingAddress: z.object({
    fullName: z.string().trim().min(1, 'Cần họ tên người nhận').max(100),
    phone: z.string().regex(/^(0|\+84)\d{9}$/, 'Số điện thoại Việt Nam không hợp lệ'),
    address: z.string().trim().min(1, 'Cần địa chỉ').max(200),
    province: z.string().trim().min(1, 'Cần tỉnh, thành phố').max(100),
  }),
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

/** Đơn là dữ liệu riêng của từng người: không cache ở CloudFront hay trình duyệt */
function orderResponse(status: number, body: unknown): HttpResult {
  const result = json(status, body);
  return { ...result, headers: { ...result.headers, 'cache-control': 'no-store' } };
}

/** GET, DELETE đơn chưa có use case (#230, #231): trả 501 như Lambda tạm ở #234 */
const notImplemented: Route = async (event) =>
  problem({
    status: 501,
    title: 'Not Implemented',
    detail: `Route ${event.routeKey} chưa có`,
    traceId: event.requestContext.requestId,
  });

/** Bảng route → use case. Khoá trùng route trong contracts/openapi.yaml và HTTP API ở infra/. */
export const routes: Readonly<Record<string, Route>> = {
  'POST /api/v1/orders': async (event, userId, { placeOrder }, context) => {
    // Thiếu hoặc sai dạng Idempotency-Key → BadRequestError → 400 (BR-04)
    const idempotencyKey = parseIdempotencyKey(event.headers ?? {});
    const raw = readJson(event);
    const traceId = event.requestContext.requestId;
    if (raw === undefined) {
      return problem({ status: 400, title: 'Bad Request', detail: 'Body phải là JSON', traceId });
    }
    const body = createOrderBody.safeParse(raw);
    if (!body.success) return validationProblem(body.error, traceId);

    const { value, replayed } = await placeOrder(
      { userId, idempotencyKey, correlationId: traceId, ...body.data },
      context,
    );
    // 201 lần đầu; gọi lại cùng khoá (Powertools hoặc item đánh dấu) trả 200 cùng đơn
    return orderResponse(value.created && !replayed ? 201 : 200, value.order);
  },
  'GET /api/v1/orders': notImplemented,
  'GET /api/v1/orders/{orderId}': notImplemented,
  'DELETE /api/v1/orders/{orderId}': notImplemented,
};
