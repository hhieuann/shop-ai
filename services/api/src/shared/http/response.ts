import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { ZodError } from 'zod';
import { AppError, type ErrorKind } from '../errors.js';

export type HttpResult = APIGatewayProxyStructuredResultV2;

export function json(statusCode: number, body: unknown): HttpResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

interface ProblemInit {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly code?: string;
  readonly traceId: string;
  readonly errors?: readonly { field: string; message: string }[];
}

/** Lỗi theo RFC 9457 (application/problem+json), khớp schema Problem trong contracts/openapi.yaml. */
export function problem({ status, title, ...rest }: ProblemInit): HttpResult {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/problem+json' },
    body: JSON.stringify({ type: 'about:blank', title, status, ...rest }),
  };
}

const HTTP_BY_KIND: Readonly<Record<ErrorKind, { status: number; title: string }>> = {
  BAD_REQUEST: { status: 400, title: 'Bad Request' },
  NOT_FOUND: { status: 404, title: 'Not Found' },
  CONFLICT: { status: 409, title: 'Conflict' },
  UNPROCESSABLE: { status: 422, title: 'Unprocessable Content' },
};

/** Chỗ duy nhất đổi lỗi nghiệp vụ sang HTTP. Lỗi không lường trước trả 500 và không lộ chi tiết. */
export function errorToProblem(error: unknown, traceId: string): HttpResult {
  if (error instanceof AppError) {
    return problem({
      ...HTTP_BY_KIND[error.kind],
      detail: error.message,
      ...(error.code === undefined ? {} : { code: error.code }),
      traceId,
    });
  }
  return problem({ status: 500, title: 'Internal Server Error', traceId });
}

export function validationProblem(error: ZodError, traceId: string): HttpResult {
  return problem({
    status: 400,
    title: 'Bad Request',
    detail: 'Dữ liệu gửi lên không hợp lệ',
    traceId,
    errors: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  });
}
