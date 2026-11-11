// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProductSummary } from '../../../shared/api/types';
import { ApiError } from '../../../shared/api/client';
import { setTokenProvider } from '../../../shared/auth/token';
import { useCart } from './useCart';

const recordEvent = vi.fn();
vi.mock('../../../shared/api/events', () => ({
  recordEvent: (...args: unknown[]) => recordEvent(...args),
}));

const GUEST_CART = 'shop-ai:guest-cart';

/** Sản phẩm như trong GET /products: không có description, createdAt, updatedAt */
const summary: ProductSummary = {
  productId: 'p-gpu-1',
  name: 'Card màn hình MSI GeForce RTX 4060',
  category: 'gpu',
  brand: 'MSI',
  price: 7_990_000,
  stock: 2,
  status: 'ACTIVE',
  specs: { vram: '8GB GDDR6' },
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  recordEvent.mockClear();
});
afterEach(() => {
  localStorage.clear();
  setTokenProvider(() => null);
  vi.unstubAllGlobals();
});

describe('useCart.add với sản phẩm rút gọn (thẻ trang danh sách)', () => {
  it('khách chưa đăng nhập: thêm 1 món vào giỏ trên trình duyệt', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isGuest).toBe(true));

    await result.current.add.mutateAsync({ product: summary, quantity: 1 });

    expect(JSON.parse(localStorage.getItem(GUEST_CART) ?? '[]')).toEqual([
      { productId: 'p-gpu-1', quantity: 1, addedPrice: 7_990_000 },
    ]);
  });

  it('vượt tồn kho: báo QUANTITY_LIMIT kèm số còn thêm được, giỏ giữ nguyên', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isGuest).toBe(true));
    await result.current.add.mutateAsync({ product: summary, quantity: 2 });

    const error = await result.current.add
      .mutateAsync({ product: summary, quantity: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'QUANTITY_LIMIT', maxAddable: 0 });
    expect(JSON.parse(localStorage.getItem(GUEST_CART) ?? '[]')[0].quantity).toBe(2);
  });
});

describe('useCart.add ghi sự kiện ADD_TO_CART cho gợi ý', () => {
  const cart = { items: [], totalAmount: 0, totalQuantity: 0 };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('đã đăng nhập, thêm giỏ thành công: gửi ADD_TO_CART sau POST /cart/items', async () => {
    // Arrange
    setTokenProvider(() => 'signed-in');
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/cart') ? json(cart) : json(cart, 201),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.session).toBe('signedIn'));

    // Act
    await result.current.add.mutateAsync({ product: summary, quantity: 1 });

    // Assert
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/cart/items')).toBe(true);
    // Verify
    expect(recordEvent).toHaveBeenCalledExactlyOnceWith('p-gpu-1', 'ADD_TO_CART');
  });

  it('đã đăng nhập, thêm giỏ lỗi: không gửi', async () => {
    setTokenProvider(() => 'signed-in');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/cart') ? json(cart) : json({ status: 409, code: 'CART_FULL' }, 409),
      ),
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.session).toBe('signedIn'));

    await result.current.add.mutateAsync({ product: summary, quantity: 1 }).catch(() => undefined);

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('khách vãng lai thêm giỏ: không gửi', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isGuest).toBe(true));

    await result.current.add.mutateAsync({ product: summary, quantity: 1 });

    expect(recordEvent).not.toHaveBeenCalled();
  });
});
