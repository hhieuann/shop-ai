import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

interface ApiEventInit {
  /** Đúng như route khai báo trong HTTP API, vd. 'GET /api/v1/products/{id}' */
  readonly routeKey: string;
  readonly pathParameters?: Record<string, string>;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  /** Có userId thì event mang claim `sub` như khi đã qua JWT authorizer của Cognito. */
  readonly userId?: string;
}

/** Event HTTP API (payload 2.0) giống lúc API Gateway gọi Lambda. traceId luôn là 'req-test'. */
export function apiEvent(init: ApiEventInit): APIGatewayProxyEventV2WithJWTAuthorizer {
  const [method = 'GET', template = '/'] = init.routeKey.split(' ');
  const rawPath = template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => init.pathParameters?.[key] ?? '',
  );

  return {
    version: '2.0',
    routeKey: init.routeKey,
    rawPath,
    rawQueryString: '',
    headers: { 'content-type': 'application/json', ...init.headers },
    pathParameters: init.pathParameters,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-test',
      domainName: 'api-test.execute-api.ap-southeast-1.amazonaws.com',
      domainPrefix: 'api-test',
      http: {
        method,
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'req-test',
      routeKey: init.routeKey,
      stage: '$default',
      time: '01/Oct/2026:00:00:00 +0000',
      timeEpoch: Date.parse('2026-10-01T00:00:00Z'),
      authorizer: {
        principalId: '',
        integrationLatency: 0,
        jwt: { claims: init.userId ? { sub: init.userId } : {}, scopes: [] },
      },
    },
  };
}

export function parseBody(res: APIGatewayProxyStructuredResultV2): unknown {
  return JSON.parse(res.body ?? 'null');
}
