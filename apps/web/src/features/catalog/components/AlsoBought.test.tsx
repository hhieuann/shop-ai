// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { CartStatus } from '../../cart/hooks/useCart';
import { AlsoBought } from './AlsoBought';

let cart: { status: CartStatus; items: { productId: string }[] } = { status: 'ready', items: [] };
vi.mock('../../cart/hooks/useCart', () => ({ useCart: () => cart }));

/** Sản phẩm giả trong response gợi ý (ProductSummary) */
function product(i: number) {
  return {
    productId: `p-${i}`,
    name: `Sản phẩm ${i}`,
    category: 'psu',
    brand: 'Hãng',
    price: 1_000_000 + i,
    stock: 10,
    status: 'ACTIVE',
    imageUrl: null,
  };
}

/** Response giả theo URL được gọi; mặc định 2 món mua kèm */
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
  cart = { status: 'ready', items: [] };
  fetchMock.mockClear();
  response = () =>
    new Response(JSON.stringify({ source: 'ALSO_BOUGHT', items: [product(1), product(2)] }), {
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
        <AlsoBought productId="gpu-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AlsoBought', () => {
  it('showsRecommendationsForCurrentProduct', async () => {
    // Act
    renderWidget();

    // Assert
    expect(await screen.findByText('Sản phẩm 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thường mua kèm' })).toBeInTheDocument();
    const url = new URL(fetchMock.mock.calls[0]![0], 'http://test');
    expect(url.pathname).toBe('/api/v1/recs/also-bought');
    expect(url.searchParams.get('productId')).toBe('gpu-1');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.has('exclude')).toBe(false);
  });

  it('cartItems_areExcluded', async () => {
    // Arrange: món đã có trong giỏ không gợi ý lại (chi-tiet-san-pham.md)
    cart = { status: 'ready', items: [{ productId: 'psu-1' }, { productId: 'ram-2' }] };

    // Act
    renderWidget();

    // Assert
    await screen.findByText('Sản phẩm 1');
    const url = new URL(fetchMock.mock.calls[0]![0], 'http://test');
    expect(url.searchParams.get('exclude')).toBe('psu-1,ram-2');
  });

  it('cartLoading_waitsBeforeCallingApi', () => {
    // Arrange
    cart = { status: 'loading', items: [] };

    // Act
    renderWidget();

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('emptyItems_rendersNothing', async () => {
    // Arrange
    response = () =>
      new Response(JSON.stringify({ source: 'ALSO_BOUGHT', items: [] }), {
        headers: { 'content-type': 'application/json' },
      });

    // Act
    renderWidget();

    // Assert: không có gợi ý thì không hiện khối rỗng
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('apiError_rendersNothing', async () => {
    // Arrange
    response = () => new Response('{}', { status: 500 });

    // Act
    renderWidget();

    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
