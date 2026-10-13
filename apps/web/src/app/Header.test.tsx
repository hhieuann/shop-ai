// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './Header';

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
afterEach(cleanup);

function CurrentUrl() {
  const location = useLocation();
  return <p data-testid="url">{`${location.pathname}${location.search}`}</p>;
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Header />
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
