// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SessionStatus } from '../../../shared/auth/useSession';
import { PopularProducts } from './PopularProducts';

let session: SessionStatus = 'guest';
vi.mock('../../../shared/auth/useSession', () => ({ useSession: () => session }));

/** Sản phẩm giả trong response gợi ý (ProductSummary) */
function product(i: number) {
  return {
    productId: `p-${i}`,
    name: `Sản phẩm ${i}`,
    category: 'gpu',
    brand: 'Hãng',
    price: 1_000_000 + i,
    stock: 10,
    status: 'ACTIVE',
    imageUrl: null,
  };
}

/** Response giả theo URL được gọi; mặc định 2 món bán chạy */
let response: (url: string) => Response;
const fetchMock = vi.fn(async (url: string) => response(url));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  session = 'guest';
  fetchMock.mockClear();
  response = () =>
    new Response(JSON.stringify({ source: 'BESTSELLER', items: [product(1), product(2)] }), {
      headers: { 'content-type': 'application/json' },
    });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderWidget() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PopularProducts />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PopularProducts', () => {
  it('guest_showsBestsellers', async () => {
    // Act
    renderWidget();

    // Assert
    expect(await screen.findByText('Sản phẩm 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Đang được mua nhiều' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/recs/bestsellers?limit=10');
  });

  it('signedIn_showsForYou', async () => {
    // Arrange
    session = 'signedIn';

    // Act
    renderWidget();

    // Assert
    expect(await screen.findByText('Sản phẩm 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dành cho bạn' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/recs/for-you?limit=10');
  });

  it('sessionLoading_waitsBeforeCallingApi', () => {
    // Arrange
    session = 'loading';

    // Act
    renderWidget();

    // Assert: chưa biết đăng nhập hay chưa thì chưa hiện khối, chưa gọi API nào
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emptyItems_hidesBlock', async () => {
    // Arrange
    response = () =>
      new Response(JSON.stringify({ source: 'BESTSELLER', items: [] }), {
        headers: { 'content-type': 'application/json' },
      });

    // Act
    renderWidget();

    // Assert: không để khối rỗng (trang-chu.md §3.6)
    await waitFor(() => expect(screen.queryByRole('heading')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalled();
  });

  it('apiError_hidesBlock', async () => {
    // Arrange
    response = () => new Response('{}', { status: 500 });

    // Act
    renderWidget();

    // Assert
    await waitFor(() => expect(screen.queryByRole('heading')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalled();
  });
});
