/**
 * Đăng nhập người dùng E2E qua Cognito rồi gọi API cần đăng nhập (account.md: đăng nhập bằng email).
 * Chỉ đọc, không ghi dữ liệu (PATCH /me chỉ thử trường hợp bị chặn).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { call, ready, signIn } from './api.js';

describe.skipIf(!ready)('E2E đăng nhập', () => {
  let token = '';

  beforeAll(async () => {
    token = await signIn();
  });

  it('signIn_returnsAccessToken_whenCredentialsCorrect', () => {
    // Assert: JWT gồm 3 phần
    expect(token.split('.')).toHaveLength(3);
  });

  it('me_returnsUserIdAndGroups_whenSignedIn', async () => {
    // Act
    const res = await call('/me', { token });

    // Assert: access token không chứa email nên chỉ có userId và nhóm; không lưu cache
    expect(res.status).toBe(200);
    expect(res.cacheControl).toContain('no-store');
    expect(res.body).toMatchObject({
      userId: expect.stringMatching(/\S/),
      groups: expect.any(Array),
    });
  });

  it('patchMe_returns400WithoutChanging_whenUsernameBreaksRules', async () => {
    // Act: sai luật thì bị chặn trước khi gọi Cognito, nên không đổi gì của người dùng E2E
    const res = await call('/me', { method: 'PATCH', token, body: { username: 'Sai Luật' } });

    // Assert
    expect(res.status).toBe(400);
    expect(res.contentType).toContain('application/problem+json');
    expect(res.body).toMatchObject({ code: 'USERNAME_INVALID' });
  });

  it('patchMe_returns401_withoutToken', async () => {
    // Act
    const res = await call('/me', { method: 'PATCH', body: { username: 'hoang.nm' } });

    // Assert: JWT authorizer chặn trước Lambda
    expect(res.status).toBe(401);
  });
});
