// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { loadFlyToCart } from '../features/cart/lib/loadFlyToCart';
import { Header } from './Header';

// Tải phần hiệu ứng bay thất bại (mạng chập chờn, file cũ bị xoá sau deploy)
vi.mock('../features/cart/components/FlyToCart', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

window.matchMedia = ((query: string) => ({
  matches: true,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('Header khi tải hiệu ứng thêm vào giỏ lỗi', () => {
  it('loadFlyToCart không ném lỗi, trả component rỗng', async () => {
    const { default: Empty } = await loadFlyToCart();
    const { container, unmount } = render(<Empty />);
    expect(container).toBeEmptyDOMElement();
    unmount();
  });

  it('header vẫn vẽ link giỏ và nhãn số, trang không sập', async () => {
    localStorage.setItem(
      'shop-ai:guest-cart',
      JSON.stringify([{ productId: 'p-1', quantity: 1, addedPrice: 100 }]),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const link = await screen.findByRole('link', { name: 'Giỏ hàng, 1 sản phẩm' });
    expect(await within(link).findByTestId('cart-badge')).toHaveTextContent('1');
    localStorage.clear();
  });
});
