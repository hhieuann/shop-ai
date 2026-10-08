import { describe, expect, it } from 'vitest';
import { handler } from './handler.js';

describe('health handler', () => {
  it('handler_returnsStatusOk_always', async () => {
    // Act
    const result = await handler();

    // Assert: khớp schema getHealth trong contracts/openapi.yaml
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual({ status: 'ok' });
  });

  it('handler_isNeverCached', async () => {
    // Act
    const result = await handler();

    // Assert: CloudFront hay trình duyệt không được giữ kết quả cũ, nếu không health luôn "ok" dù API đã sập
    expect(result.headers).toMatchObject({
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
  });
});
