import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { validationProblem, type HttpResult } from '../../shared/http/response.js';
import { CLIENT_EVENT_TYPES } from './domain/event.js';
import type { RecordEventInput } from './application/recordEvent.js';

/** Use case mà handler cần. lambda.ts truyền bản thật, test truyền mock. */
export interface EventUseCases {
  recordEvent(input: RecordEventInput): Promise<void>;
}

type Route = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  userId: string,
  useCases: EventUseCases,
) => Promise<HttpResult>;

/**
 * EventInput trong contracts/openapi.yaml. strict(): có trường lạ như userId, timestamp thì 400
 * (additionalProperties: false). enum không có PURCHASE nên client gửi PURCHASE cũng 400.
 */
const eventBody = z
  .object({
    productId: z
      .string()
      .regex(
        /^[A-Za-z0-9-]{1,64}$/,
        'productId chỉ gồm chữ, số và dấu gạch ngang, tối đa 64 ký tự',
      ),
    eventType: z.enum(CLIENT_EVENT_TYPES, { error: 'eventType chỉ nhận VIEW hoặc ADD_TO_CART' }),
  })
  .strict();

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

export const routes: Readonly<Record<string, Route>> = {
  'POST /api/v1/events': async (event, userId, useCases) => {
    const parsed = eventBody.safeParse(readJson(event));
    if (!parsed.success) return validationProblem(parsed.error, event.requestContext.requestId);
    await useCases.recordEvent({ userId, ...parsed.data });
    return { statusCode: 202 };
  },
};
