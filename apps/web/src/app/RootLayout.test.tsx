// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// Header đầy đủ thật cần phiên, giỏ, danh mục: thay bằng bản giả có ô tìm kiếm để nhận ra
vi.mock('./Header', () => ({
  Header: () => (
    <header>
      <input type="search" aria-label="Tìm sản phẩm" />
    </header>
  ),
}));
vi.mock('./Footer', () => ({ Footer: () => <footer>Chân trang</footer> }));
// Trang thật không liên quan tới phép thử khung trang
vi.mock('../features/orders/pages/CheckoutPage', () => ({
  CheckoutPage: () => <h1>Đặt hàng</h1>,
}));
vi.mock('../features/cart/pages/CartPage', () => ({ CartPage: () => <h1>Giỏ hàng</h1> }));

afterEach(cleanup);

async function renderAt(path: string) {
  // Dùng đúng danh sách route của web để kiểm cả handle khai báo trong router.tsx
  const { routes } = await import('../router');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
}

describe('RootLayout: bố cục tập trung (design-system §9.16)', () => {
  it('checkout_usesMiniHeader_withBackToCartAndLogo', async () => {
    // Act
    await renderAt('/checkout');

    // Assert: không có header đầy đủ (ô tìm kiếm), chỉ logo và link quay lại giỏ
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('link', { name: 'Quay lại giỏ hàng' })).toHaveAttribute(
      'href',
      '/cart',
    );
    expect(screen.getByRole('link', { name: 'Black Magic, về trang chủ' })).toHaveAttribute(
      'href',
      '/',
    );
    // Vẫn giữ vùng nội dung chính (đích của "Bỏ qua tới nội dung chính") và chân trang
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByText('Chân trang')).toBeInTheDocument();
  });

  it('otherRoutes_keepFullHeader_withoutBackLink', async () => {
    // Act
    await renderAt('/cart');

    // Assert
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quay lại giỏ hàng' })).toBeNull();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});
