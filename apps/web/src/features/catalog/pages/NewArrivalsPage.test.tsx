// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NewArrivalsPage } from './NewArrivalsPage';

const product = (i: number) => ({
  productId: `01KAB3Q5G000000000000000${String(i).padStart(2, '0')}`,
  name: `Sản phẩm mới ${i}`,
  category: 'mouse',
  brand: 'Logitech',
  price: 300_000 + i,
  stock: 5,
  status: 'ACTIVE',
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status < 400 ? 'application/json' : 'application/problem+json' },
  });
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/new-arrivals']}>
        <NewArrivalsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NewArrivalsPage (pages/hang-moi-ve.md, #567)', () => {
  it('shows20Newest_withoutPager_andLinkToAllProducts', async () => {
    // Arrange: API có trang sau nhưng trang này không phân trang
    fetchMock.mockResolvedValue(
      json({ items: Array.from({ length: 20 }, (_, i) => product(i + 1)), nextCursor: 'abc' }),
    );

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Sản phẩm mới 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Hàng mới về' })).toBeInTheDocument();
    expect(screen.getByText('20 sản phẩm mới nhất của shop')).toBeInTheDocument();
    // Danh sách sản phẩm (breadcrumb cũng là một list)
    const grid = screen.getByText('Sản phẩm mới 1').closest('ul')!;
    expect(within(grid).getAllByRole('listitem')).toHaveLength(20);
    expect(screen.queryByRole('link', { name: /Sau|Trước/ })).toBeNull();
    expect(screen.queryByRole('navigation', { name: /trang/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Xem tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/products',
    );
    expect(document.title).toBe('Hàng mới về | Black Magic');
    // Verify: một lần gọi, đúng sắp xếp và số món
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/products?sort=newest&limit=20');
  });

  it('showsLoading_thenErrorWithRetry_thatRefetches', async () => {
    // Arrange: lần đầu lỗi, lần sau được
    fetchMock
      .mockResolvedValueOnce(json({ title: 'Lỗi' }, 500))
      .mockResolvedValueOnce(json({ items: [product(1)] }));
    const user = userEvent.setup();

    // Act
    renderPage();

    // Assert
    expect(screen.getByText('Đang tải sản phẩm…')).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa tải được sản phẩm.');

    // Act: thử lại
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));

    // Assert
    expect(await screen.findByText('Sản phẩm mới 1')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('showsEmptyState_whenNoProducts', async () => {
    // Arrange
    fetchMock.mockResolvedValue(json({ items: [] }));

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Shop chưa có sản phẩm nào.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/products',
    );
  });
});
