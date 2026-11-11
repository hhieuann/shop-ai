// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTokenProvider } from '../../../shared/auth/token';
import { useCartCount } from './useCartCount';

const GUEST_CART = 'shop-ai:guest-cart';
const fetchMock = vi.fn();

// Một QueryClient cho mỗi test (wrapper vẽ lại nhiều lần, không tạo client mới mỗi lần)
let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  localStorage.clear();
  setTokenProvider(() => null);
  vi.unstubAllGlobals();
});

describe('useCartCount', () => {
  it('khách vãng lai: đếm số dòng giỏ trên trình duyệt, không gọi API', async () => {
    // Arrange: 2 sản phẩm khác nhau, mỗi món số lượng 3
    localStorage.setItem(
      GUEST_CART,
      JSON.stringify([
        { productId: 'p-1', quantity: 3, addedPrice: 100 },
        { productId: 'p-2', quantity: 3, addedPrice: 200 },
      ]),
    );

    // Act
    const { result } = renderHook(() => useCartCount(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current).toBe(2));
    // Verify
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('đã đăng nhập: đếm số dòng của GET /api/v1/cart, không phải tổng số lượng', async () => {
    setTokenProvider(() => 'signed-in');
    fetchMock.mockImplementation(async () =>
      json({
        items: [
          { productId: 'p-1', quantity: 5 },
          { productId: 'p-2', quantity: 1 },
          { productId: 'p-3', quantity: 2 },
        ],
        totalAmount: 0,
      }),
    );

    const { result } = renderHook(() => useCartCount(), { wrapper });

    await waitFor(() => expect(result.current).toBe(3));
    // Chỉ đọc giỏ, không gọi API sản phẩm cho từng món
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
      fetchMock.mock.calls.map(() => '/api/v1/cart'),
    );
  });

  it('đã đăng nhập mà giỏ lỗi: 0 (không hiện số)', async () => {
    setTokenProvider(() => 'signed-in');
    fetchMock.mockImplementation(async () => new Response('{}', { status: 500 }));

    const { result } = renderHook(() => useCartCount(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });
});
