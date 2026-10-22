import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { json, problem, type HttpResult } from '../../shared/http/response.js';

/** Người đang đăng nhập, lấy từ token mà JWT authorizer của HTTP API đã kiểm chữ ký và hạn dùng. */
export interface Me {
  readonly userId: string;
  /** Có khi web gửi ID token; access token của Cognito không chứa email */
  readonly email?: string;
  readonly groups: string[];
}

/** HTTP API đưa claim mảng `cognito:groups` sang dạng chuỗi "[admin customer]". */
function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string') return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

/** GET /api/v1/me. Không đọc dữ liệu: mọi thông tin đã nằm trong token. */
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<HttpResult> {
  const traceId = event.requestContext.requestId;
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || sub.length === 0) {
    return problem({ status: 401, title: 'Unauthorized', detail: 'Cần đăng nhập', traceId });
  }

  const email = claims?.email;
  const me: Me = {
    userId: sub,
    ...(typeof email === 'string' ? { email } : {}),
    groups: parseGroups(claims?.['cognito:groups']),
  };
  const result = json(200, me);
  // Thông tin riêng của từng người: không cache ở CloudFront hay trình duyệt
  return { ...result, headers: { ...result.headers, 'cache-control': 'no-store' } };
}
