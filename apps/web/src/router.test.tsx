// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { queryClient } from './queryClient';

/** Code trang chi tiết giả, tải chậm: test tự quyết lúc tải xong */
let finishPageLoad: () => void = () => undefined;
vi.mock('./features/catalog/pages/ProductDetailPage', async () => {
  await new Promise<void>((resolve) => {
    finishPageLoad = resolve;
  });
  const { useQuery } = await import('@tanstack/react-query');
  const { productDetailQuery } = await import('./features/catalog/lib/productDetailQuery');
  return {
    ProductDetailPage: () => {
      const { data } = useQuery(productDetailQuery('p-1'));
      return <h1>{data?.name ?? 'Đang tải'}</h1>;
    },
  };
});
// Header, footer của RootLayout không liên quan tới phép thử này
vi.mock('./app/RootLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { RootLayout: () => <Outlet /> };
});

const fetchMock = vi.fn<(url: string) => Promise<Response>>(
  async () =>
    new Response(JSON.stringify({ productId: 'p-1', name: 'RTX 4060' }), {
      headers: { 'content-type': 'application/json' },
    }),
);
const productCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === '/api/v1/products/p-1');

beforeEach(() => {
  queryClient.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('router: route trang chi tiết tải trước dữ liệu sản phẩm', () => {
  it('gọi API sản phẩm ngay khi route khớp, trước khi code trang tải xong; trang dùng lại, chỉ gọi 1 lần', async () => {
    // Arrange
    const { routes } = await import('./router');
    const router = createMemoryRouter(routes, { initialEntries: ['/products/p-1'] });

    // Act: mở trang, code trang chưa tải xong
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(productCalls()).toHaveLength(1));

    // Code trang tải xong
    await act(async () => finishPageLoad());

    // Assert
    expect(await screen.findByRole('heading', { name: 'RTX 4060' })).toBeInTheDocument();
    // Verify: trang lấy dữ liệu loader đã tải, không gọi lần hai
    expect(productCalls()).toHaveLength(1);
  });
});
