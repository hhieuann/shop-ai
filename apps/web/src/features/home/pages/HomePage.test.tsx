// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HomePage } from './HomePage';

/** Sản phẩm giả cho các khối; category theo bộ lọc của request */
function product(i: number, category: string) {
  return {
    productId: `p-${category}-${i}`,
    name: `Sản phẩm ${category} ${i}`,
    category,
    brand: 'Hãng',
    price: 1_000_000 + i,
    stock: 10,
    status: 'ACTIVE',
    imageUrl: null,
  };
}

let failProducts = false;

beforeEach(() => {
  failProducts = false;
  localStorage.clear();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (failProducts) return new Response('{}', { status: 500 });
      const params = new URL(url, 'http://test').searchParams;
      const category = params.get('category') ?? 'gpu';
      const items = Array.from({ length: 12 }, (_, i) => product(i, category));
      return new Response(JSON.stringify({ items, nextCursor: null }), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function RegisterState() {
  const location = useLocation();
  return <p data-testid="register-from">{(location.state as { from?: string })?.from}</p>;
}

function renderHome() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterState />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  it('có h1 ẩn, menu danh mục, hero và 3 ô thường mua kèm đúng đường dẫn', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Black Magic: laptop và linh kiện PC' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Danh mục' })).getAllByRole('link'),
    ).toHaveLength(13);

    const hero = screen.getByRole('region', {
      name: 'Mua card đồ hoạ, xem luôn món thường mua kèm',
    });
    expect(within(hero).getByRole('link', { name: 'Xem card đồ hoạ' })).toHaveAttribute(
      'href',
      '/products?category=gpu',
    );

    const pairs = within(screen.getByRole('list', { name: 'Thường mua kèm' })).getAllByRole('link');
    expect(pairs.map((a) => a.getAttribute('href'))).toEqual([
      '/products?category=psu',
      '/products?category=mainboard',
      '/products?category=mouse',
    ]);
    // Tên đọc được của ô là tiêu đề + mô tả
    expect(pairs[0]).toHaveAccessibleName('Card đồ hoạ + Nguồn RTX 4070 Super cần nguồn từ 750W');
  });

  it('4 khối sản phẩm theo thứ tự, khối gợi ý "Đang được mua nhiều" đứng đầu; khối thường có link Xem tất cả', async () => {
    renderHome();
    // Khối gợi ý hiện sau khi biết khách chưa đăng nhập
    await screen.findByRole('heading', { level: 2, name: 'Đang được mua nhiều' });
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((t) => t !== 'Mua card đồ hoạ, xem luôn món thường mua kèm');
    expect(titles).toEqual(['Đang được mua nhiều', 'Hàng mới về', 'Card đồ hoạ', 'Laptop']);

    const laptop = screen.getByRole('region', { name: 'Laptop' });
    expect(within(laptop).getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute(
      'href',
      '/products?category=laptop',
    );
    expect(await within(laptop).findAllByRole('article')).toHaveLength(12);
  });

  it('khách chưa đăng nhập: link Tạo tài khoản mang state.from là trang chủ', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('link', { name: 'Tạo tài khoản' }));
    expect(screen.getByTestId('register-from')).toHaveTextContent('/');
  });

  it('đã đăng nhập: ẩn ô "Chưa có tài khoản?"', async () => {
    localStorage.setItem('shop-ai:dev-token', 'dev');
    renderHome();
    await screen.findByText('Giao hàng miễn phí mọi đơn');
    await vi.waitFor(() => expect(screen.queryByText('Chưa có tài khoản?')).toBeNull());
  });

  it('lỗi tải sản phẩm: hiện thông báo trong từng khối', async () => {
    failProducts = true;
    renderHome();
    await vi.waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(3));
    const alerts = screen.getAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('Chưa tải được sản phẩm. Tải lại trang để thử lần nữa.');
  });
});
