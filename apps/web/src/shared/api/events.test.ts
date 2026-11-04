import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTokenProvider } from '../auth/token';
import { recordEvent } from './events';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  setTokenProvider(() => null);
  vi.unstubAllGlobals();
});

describe('recordEvent', () => {
  it('chưa đăng nhập thì không gọi API', async () => {
    // Arrange
    setTokenProvider(() => null);

    // Act
    await recordEvent('p-gpu-1', 'VIEW');

    // Verify
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('đã đăng nhập: POST /api/v1/events đúng body, không trường lạ, có keepalive', async () => {
    // Arrange
    setTokenProvider(() => 'signed-in');

    // Act
    await recordEvent('p-gpu-1', 'ADD_TO_CART');

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/events');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual({
      productId: 'p-gpu-1',
      eventType: 'ADD_TO_CART',
    });
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer signed-in');
  });

  it.each([
    ['500', () => Promise.resolve(new Response('{}', { status: 500 }))],
    ['401', () => Promise.resolve(new Response('{}', { status: 401 }))],
    ['lỗi mạng', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('API trả %s: không ném lỗi ra ngoài, không thử lại', async (_name, reply) => {
    // Arrange
    setTokenProvider(() => 'signed-in');
    fetchMock.mockImplementation(reply);

    // Act
    const result = recordEvent('p-gpu-1', 'VIEW');

    // Assert
    await expect(result).resolves.toBeUndefined();
    // Verify
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
