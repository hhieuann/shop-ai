import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { handler } from './handler.js';

/** Event như HTTP API gửi sau khi JWT authorizer đã kiểm token; claims là của access token Cognito. */
function eventWithClaims(claims: Record<string, string>): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    routeKey: 'GET /api/v1/me',
    requestContext: {
      requestId: 'req-1',
      authorizer: { jwt: { claims, scopes: [] }, principalId: '', integrationLatency: 0 },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

describe('account handler: GET /api/v1/me', () => {
  it('handler_returnsUserFromTokenClaims_whenSignedIn', async () => {
    // Arrange: cognito:groups trong JWT đến dạng chuỗi "[admin customer]"
    const event = eventWithClaims({
      sub: 'f1b2c3d4-0000-4000-8000-000000000001',
      username: 'f1b2c3d4-0000-4000-8000-000000000001',
      email: 'an@example.com',
      'cognito:groups': '[admin]',
    });

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual({
      userId: 'f1b2c3d4-0000-4000-8000-000000000001',
      email: 'an@example.com',
      groups: ['admin'],
    });
    expect(result.headers).toMatchObject({ 'cache-control': 'no-store' });
  });

  it('handler_returnsEmptyGroupsAndNoEmail_whenClaimsMissing', async () => {
    // Arrange: access token Cognito không có email; khách thường không thuộc nhóm nào
    const event = eventWithClaims({ sub: 'u-2' });

    // Act
    const result = await handler(event);

    // Assert
    expect(JSON.parse(result.body as string)).toEqual({ userId: 'u-2', groups: [] });
  });

  it('handler_returns401_whenNoAuthorizerContext', async () => {
    // Arrange: không bao giờ xảy ra nếu route có authorizer; phòng khi cấu hình sai
    const event = { routeKey: 'GET /api/v1/me', requestContext: { requestId: 'req-3' } } as never;

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(401);
    expect(result.headers).toMatchObject({ 'content-type': 'application/problem+json' });
  });
});
