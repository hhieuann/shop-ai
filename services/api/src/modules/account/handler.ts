import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { AppError } from '../../shared/errors.js';
import { parseGroups } from '../../shared/auth/claims.js';
import { errorToProblem, json, problem, type HttpResult } from '../../shared/http/response.js';
import { logger } from '../../shared/logger.js';

/** Người đang đăng nhập, lấy từ token mà JWT authorizer của HTTP API đã kiểm chữ ký và hạn dùng. */
export interface Me {
  readonly userId: string;
  /** Có khi web gửi ID token; access token của Cognito không chứa email */
  readonly email?: string;
  readonly groups: string[];
}

/** Use case mà handler cần. lambda.ts truyền bản thật, test truyền mock. */
export interface AccountUseCases {
  changeUsername(input: {
    readonly userId: string;
    /** Giá trị `username` trong body, chưa kiểm kiểu */
    readonly username: unknown;
  }): Promise<{ readonly username: string }>;
}

type Claims = Record<string, unknown> | undefined;

/** Thông tin riêng của từng người: không cache ở CloudFront hay trình duyệt */
function noStore(result: HttpResult): HttpResult {
  return { ...result, headers: { ...result.headers, 'cache-control': 'no-store' } };
}

/** GET /api/v1/me. Không đọc dữ liệu: mọi thông tin đã nằm trong token. */
function getMe(sub: string, claims: Claims): HttpResult {
  const email = claims?.email;
  const me: Me = {
    userId: sub,
    ...(typeof email === 'string' ? { email } : {}),
    groups: parseGroups(claims?.['cognito:groups']),
  };
  return noStore(json(200, me));
}

/**
 * PATCH /api/v1/me: đổi username (account.md BR-06). Body `{ "username": "..." }`.
 * Kiểm username (thiếu, sai kiểu, sai luật) nằm ở use case changeUsername.
 */
async function patchMe(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  sub: string,
  useCases: AccountUseCases,
  traceId: string,
): Promise<HttpResult> {
  let body: unknown;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : event.body;
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return problem({ status: 400, title: 'Bad Request', detail: 'Body phải là JSON', traceId });
  }
  const username =
    body !== null && typeof body === 'object'
      ? (body as { username?: unknown }).username
      : undefined;
  const result = await useCases.changeUsername({ userId: sub, username });
  return noStore(json(200, result));
}

/** Route GET và PATCH /api/v1/me, cả hai gắn JWT authorizer (infra/lib/api-stack.ts). */
export function makeHandler(useCases: AccountUseCases) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<HttpResult> => {
    const traceId = event.requestContext.requestId;
    const claims = event.requestContext.authorizer?.jwt?.claims as Claims;
    const sub = claims?.sub;
    if (typeof sub !== 'string' || sub.length === 0) {
      return problem({ status: 401, title: 'Unauthorized', detail: 'Cần đăng nhập', traceId });
    }

    try {
      if (event.routeKey === 'PATCH /api/v1/me') {
        return await patchMe(event, sub, useCases, traceId);
      }
      return getMe(sub, claims);
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('Lỗi không lường trước', { error, traceId, routeKey: event.routeKey });
      }
      return errorToProblem(error, traceId);
    }
  };
}
