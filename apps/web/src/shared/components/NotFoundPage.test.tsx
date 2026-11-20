// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// Header đầy đủ thật cần phiên, giỏ, danh mục: thay bằng bản giả có ô tìm kiếm để nhận ra
vi.mock('../../app/Header', () => ({
  Header: () => (
    <header>
      <input type="search" aria-label="Tìm sản phẩm" />
    </header>
  ),
}));
vi.mock('../../app/Footer', () => ({ Footer: () => <footer>Chân trang</footer> }));

afterEach(cleanup);

async function renderAt(path: string) {
  // Dùng đúng danh sách route của web: đường dẫn lạ rơi vào route '*'
  const { routes } = await import('../../router');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return screen.findByRole('heading', { level: 1 });
}

describe('Trang 404 (pages/khong-tim-thay.md)', () => {
  it('unknownPath_showsNotFoundPage_withLinksAndFullHeader', async () => {
    // Act
    const heading = await renderAt('/khuyen-mai');

    // Assert: một h1 trong khối section trỏ vào nó
    expect(heading).toHaveTextContent('Không tìm thấy trang');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Đường dẫn có thể đã sai hoặc trang đã bị gỡ. Bạn có thể tìm sản phẩm ở ô tìm kiếm phía trên.',
      ),
    ).toBeInTheDocument();
    // Hai nút đi tiếp
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Xem tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/products',
    );
    // Header đầy đủ vẫn có ô tìm kiếm, nội dung trong <main>
    expect(screen.getByRole('searchbox', { name: 'Tìm sản phẩm' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(heading);
  });

  it('deepUnknownPath_alsoShowsNotFoundPage', async () => {
    const heading = await renderAt('/products/abc/xyz');

    expect(heading).toHaveTextContent('Không tìm thấy trang');
  });
});
