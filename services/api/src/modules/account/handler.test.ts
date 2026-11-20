import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../../shared/errors.js';
import { makeHandler, type AccountUseCases } from './handler.js';

/** GET /me không gọi use case nào */
const handler = makeHandler({
  changeUsername: async () => {
    throw new Error('không được gọi');
  },
});

/** Event như HTTP API gửi sau khi JWT authorizer đã kiểm token; claims là của access token Cognito. */
function eventWithClaims(
  claims: Record<string, string>,
  extra: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    routeKey: 'GET /api/v1/me',
    ...extra,
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

describe('account handler: PATCH /api/v1/me', () => {
  const ME = 'f1b2c3d4-0000-4000-8000-000000000001';

  function patch(body: string | undefined, changeUsername: AccountUseCases['changeUsername']) {
    const event = eventWithClaims(
      { sub: ME },
      { routeKey: 'PATCH /api/v1/me', ...(body === undefined ? {} : { body }) },
    );
    return makeHandler({ changeUsername })(event);
  }

  it('handler_changesUsernameOfTokenOwner_whenBodyValid', async () => {
    // Arrange
    const changeUsername = vi.fn(async () => ({ username: 'hoang.nm' }));

    // Act
    const result = await patch(JSON.stringify({ username: 'hoang.nm' }), changeUsername);

    // Assert: userId lấy từ token, không từ body
    expect(changeUsername).toHaveBeenCalledWith({ userId: ME, username: 'hoang.nm' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual({ username: 'hoang.nm' });
    expect(result.headers).toMatchObject({ 'cache-control': 'no-store' });
  });

  it('handler_passesUndefinedUsername_whenBodyMissing', async () => {
    // Arrange
    const changeUsername = vi.fn(async () => ({ username: 'x' }));

    // Act
    await patch(undefined, changeUsername);

    // Assert: use case báo USERNAME_REQUIRED
    expect(changeUsername).toHaveBeenCalledWith({ userId: ME, username: undefined });
  });

  it('handler_returns400_whenBodyIsNotJson', async () => {
    // Act
    const result = await patch('{username:', async () => ({ username: 'x' }));

    // Assert
    expect(result.statusCode).toBe(400);
    expect(result.headers).toMatchObject({ 'content-type': 'application/problem+json' });
  });

  it('handler_returns409WithCode_whenUsernameTaken', async () => {
    // Act
    const result = await patch(JSON.stringify({ username: 'an_nguyen' }), async () => {
      throw new ConflictError('Username này đã có người dùng', { code: 'USERNAME_TAKEN' });
    });

    // Assert
    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body as string)).toMatchObject({ code: 'USERNAME_TAKEN' });
  });

  it('handler_returns500WithoutDetail_whenCognitoFails', async () => {
    // Act
    const result = await patch(JSON.stringify({ username: 'hoang.nm' }), async () => {
      throw new Error('AccessDeniedException: arn:aws:cognito-idp:...');
    });

    // Assert: không lộ lỗi của AWS ra ngoài
    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('AccessDenied');
  });
});
