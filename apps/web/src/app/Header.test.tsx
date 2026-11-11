// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  createMemoryRouter,
  useLocation,
} from 'react-router-dom';
import { Header } from './Header';
import { RootLayout, type RouteHandle } from './RootLayout';

/** jsdom không có matchMedia: điều khiển bản máy tính (≥1280) hay điện thoại bằng biến này */
let desktop = true;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
beforeEach(() => {
  desktop = true;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  scrollPage(0);
});

/** jsdom không cuộn thật: đặt scrollY rồi phát sự kiện scroll như trình duyệt */
function scrollPage(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
  fireEvent.scroll(window);
}

const needsNav = () => screen.getByRole('navigation', { name: 'Mua theo nhu cầu' });

function CurrentUrl() {
  const location = useLocation();
  return <p data-testid="url">{`${location.pathname}${location.search}`}</p>;
}

function renderAt(path: string, collapseNeeds = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Header collapseNeeds={collapseNeeds} />
        <Routes>
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Header', () => {
  it('hàng 2 có 6 link mua theo nhu cầu, đúng đường dẫn', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Mua theo nhu cầu' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Hàng mới về', '/products?sort=newest'],
      ['Chơi game', '/products?category=gpu'],
      ['Làm văn phòng', '/products?category=laptop'],
      ['Học lập trình', '/products?category=ram'],
      ['Thiết kế, dựng phim', '/products?category=monitor'],
      ['Tất cả sản phẩm', '/products'],
    ]);
    expect(links.filter((a) => a.hasAttribute('aria-current'))).toHaveLength(0);
  });

  it('chỉ đánh dấu link khớp cả bộ lọc trên URL', () => {
    renderAt('/products?category=gpu');
    const nav = screen.getByRole('navigation', { name: 'Mua theo nhu cầu' });
    expect(within(nav).getByRole('link', { name: 'Chơi game' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Tất cả sản phẩm' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('đang ở trang sau của một bộ lọc vẫn đánh dấu link của bộ lọc đó', () => {
    renderAt('/products?category=gpu&cursor=abc&page=2');
    const nav = screen.getByRole('navigation', { name: 'Mua theo nhu cầu' });
    expect(within(nav).getByRole('link', { name: 'Chơi game' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('tìm kiếm: bỏ khoảng trắng hai đầu rồi sang /products?q=…', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.type(
      screen.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' }),
      '  rtx 4070 ',
    );
    await user.click(screen.getByRole('button', { name: 'Tìm' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/products?q=rtx%204070');
  });

  it('máy tính: nút Danh mục mở bảng 13 loại hàng, đánh dấu loại đang xem, Esc đóng', async () => {
    const user = userEvent.setup();
    renderAt('/products?category=gpu');
    const trigger = screen.getByRole('button', { name: 'Danh mục' });

    await user.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Danh mục' });
    expect(panel).toHaveAttribute('aria-modal', 'false');
    const items = within(panel).getAllByRole('link');
    expect(items).toHaveLength(13);
    expect(items[0]).toHaveFocus();
    expect(within(panel).getByRole('link', { name: 'Card đồ hoạ' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('máy tính: bấm một loại hàng thì sang trang lọc và đóng bảng', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Danh mục' }));
    await user.click(screen.getByRole('link', { name: 'Chuột' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/products?category=mouse');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('điện thoại: ngăn kéo modal có link Đơn hàng trên 13 loại hàng, Tab đi vòng trong ngăn kéo', async () => {
    desktop = false;
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Danh mục' }));

    const drawer = screen.getByRole('dialog', { name: 'Danh mục' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    const orders = within(drawer).getByRole('link', { name: 'Đơn hàng' });
    expect(orders).toHaveAttribute('href', '/orders');
    expect(orders).toHaveFocus();
    expect(within(drawer).getAllByRole('link')).toHaveLength(14);

    // Từ mục cuối Tab về nút Đóng (phần tử đầu tiên)
    within(drawer).getByRole('link', { name: 'Phụ kiện' }).focus();
    await user.tab();
    expect(within(drawer).getByRole('button', { name: 'Đóng' })).toHaveFocus();

    await user.click(within(drawer).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Danh mục' })).toHaveFocus();
  });
});

describe('Header: số trên icon giỏ', () => {
  it('giỏ trống: link "Giỏ hàng", không có nhãn số', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Giỏ hàng' })).toBeInTheDocument();
    expect(screen.queryByTestId('cart-badge')).toBeNull();
  });

  it('giỏ khách có 3 sản phẩm khác nhau: nhãn 3, link đọc "Giỏ hàng, 3 sản phẩm"', async () => {
    localStorage.setItem(
      'shop-ai:guest-cart',
      JSON.stringify(
        ['p-1', 'p-2', 'p-3'].map((productId) => ({ productId, quantity: 2, addedPrice: 100 })),
      ),
    );
    renderAt('/');
    const link = await screen.findByRole('link', { name: 'Giỏ hàng, 3 sản phẩm' });
    expect(link).toHaveAttribute('href', '/cart');
    expect(await within(link).findByTestId('cart-badge')).toHaveTextContent('3');
  });
});

describe('Header: hàng 2 thu lại khi cuộn (trang chi tiết, ≥1280)', () => {
  it('có collapseNeeds: cuộn xuống thì hàng 2 có inert, về đầu trang thì bỏ inert', () => {
    renderAt('/products/01M3GQ5TR0DH1Z32GWGG764J9X', true);
    expect(needsNav()).not.toHaveAttribute('inert');

    scrollPage(120);
    expect(needsNav()).toHaveAttribute('inert');

    scrollPage(0);
    expect(needsNav()).not.toHaveAttribute('inert');
  });

  it('vào trang khi đã đang cuộn thì hàng 2 ẩn ngay', () => {
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true, writable: true });
    renderAt('/products/01M3GQ5TR0DH1Z32GWGG764J9X', true);
    expect(needsNav()).toHaveAttribute('inert');
  });

  it('không có collapseNeeds: cuộn xuống hàng 2 không đổi', () => {
    renderAt('/products');
    scrollPage(120);
    expect(needsNav()).not.toHaveAttribute('inert');
  });

  it('dưới 1280: cuộn xuống hàng 2 không đổi', () => {
    desktop = false;
    renderAt('/products/01M3GQ5TR0DH1Z32GWGG764J9X', true);
    scrollPage(120);
    expect(needsNav()).not.toHaveAttribute('inert');
  });

  it('RootLayout bật theo handle của route, route khác không bật', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <RootLayout />,
          children: [
            {
              path: 'products/:productId',
              handle: { headerNeeds: 'collapse' } satisfies RouteHandle,
              element: <p>Chi tiết</p>,
            },
            { path: 'products', element: <p>Danh sách</p> },
          ],
        },
      ],
      { initialEntries: ['/products/01M3GQ5TR0DH1Z32GWGG764J9X'] },
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    scrollPage(120);
    expect(needsNav()).toHaveAttribute('inert');

    cleanup();
    scrollPage(0);
    const listRouter = createMemoryRouter(router.routes, { initialEntries: ['/products'] });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={listRouter} />
      </QueryClientProvider>,
    );
    scrollPage(120);
    expect(needsNav()).not.toHaveAttribute('inert');
  });

  it('RootLayout: route có handle flushTop thì main bỏ khoảng đệm trên, route khác giữ', () => {
    const routes = [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          {
            path: 'products/:productId',
            handle: { headerNeeds: 'collapse', flushTop: true } satisfies RouteHandle,
            element: <p>Chi tiết</p>,
          },
          { path: 'cart', element: <p>Giỏ hàng</p> },
        ],
      },
    ];
    const renderRoute = (path: string) =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
        </QueryClientProvider>,
      );

    renderRoute('/products/01M3GQ5TR0DH1Z32GWGG764J9X');
    expect(screen.getByRole('main').className).toMatch(/flushTop/);
    cleanup();

    renderRoute('/cart');
    expect(screen.getByRole('main').className).not.toMatch(/flushTop/);
  });
});
