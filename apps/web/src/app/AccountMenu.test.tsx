// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { notifyAuthChanged } from '../shared/auth/token';

beforeAll(() => {
  // jsdom không có ResizeObserver và matchMedia
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

function renderAt(path: string, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AccountMenu />
        <Routes>
          <Route path="*" element={<p data-testid="page">{path}</p>} />
          <Route path="/" element={<p data-testid="page">home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AccountMenu', () => {
  it('chưa đăng nhập: mở bảng lợi ích, focus nút Đăng nhập, Esc đóng và trả focus', async () => {
    const user = userEvent.setup();
    renderAt('/products');
    const trigger = await screen.findByRole('button', { name: 'Đăng nhập' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Đăng nhập để mua sắm dễ hơn' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Tạo tài khoản' })).toHaveAttribute(
      'href',
      '/register',
    );

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('đã đăng nhập: hiện username, không có Trang quản trị nếu không phải admin', async () => {
    localStorage.setItem('shop-ai:dev-token', 'dev');
    localStorage.setItem('shop-ai:dev-username', 'hoang');
    const user = userEvent.setup();
    renderAt('/products');

    await user.click(await screen.findByRole('button', { name: 'Tài khoản của hoang' }));
    const dialog = screen.getByRole('dialog', { name: 'Xin chào,' });
    expect(dialog).toHaveTextContent('hoang@example.com');
    expect(screen.queryByRole('link', { name: 'Trang quản trị' })).toBeNull();
  });

  it('admin thấy Trang quản trị', async () => {
    localStorage.setItem('shop-ai:dev-token', 'dev');
    localStorage.setItem('shop-ai:dev-admin', '1');
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /Tài khoản của/ }));
    expect(screen.getByRole('link', { name: 'Trang quản trị' })).toHaveFocus();
  });

  it('đăng xuất ở trang bắt buộc đăng nhập thì về trang chủ', async () => {
    localStorage.setItem('shop-ai:dev-token', 'dev');
    const user = userEvent.setup();
    renderAt('/orders');

    await user.click(await screen.findByRole('button', { name: /Tài khoản của/ }));
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('home'));
    expect(localStorage.getItem('shop-ai:dev-token')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('đăng xuất xoá giỏ khách, dữ liệu phiên và giỏ, đơn trong bộ nhớ đệm; giữ sản phẩm', async () => {
    localStorage.setItem('shop-ai:dev-token', 'dev');
    localStorage.setItem(
      'shop-ai:guest-cart',
      JSON.stringify([{ productId: 'gpu-1', quantity: 1, addedPrice: 100 }]),
    );
    sessionStorage.setItem('shop-ai:merge-idempotency-key', 'k-1');
    sessionStorage.setItem('shop-ai:checkout-intent', '{"items":[]}');
    sessionStorage.setItem('shop-ai:checkout-items', '[]');
    const queryClient = new QueryClient();
    queryClient.setQueryData(['cart', 'mine'], { items: [], totalAmount: 0 });
    queryClient.setQueryData(['orders', 'list'], { items: [] });
    queryClient.setQueryData(['products', 'detail', 'gpu-1'], { productId: 'gpu-1' });
    const user = userEvent.setup();
    renderAt('/products', queryClient);

    await user.click(await screen.findByRole('button', { name: /Tài khoản của/ }));
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await screen.findByRole('button', { name: 'Đăng nhập' });

    expect(localStorage.getItem('shop-ai:guest-cart')).toBeNull();
    expect(sessionStorage.getItem('shop-ai:merge-idempotency-key')).toBeNull();
    expect(sessionStorage.getItem('shop-ai:checkout-intent')).toBeNull();
    expect(sessionStorage.getItem('shop-ai:checkout-items')).toBeNull();
    expect(queryClient.getQueryData(['cart', 'mine'])).toBeUndefined();
    expect(queryClient.getQueryData(['orders', 'list'])).toBeUndefined();
    expect(queryClient.getQueryData(['products', 'detail', 'gpu-1'])).toEqual({
      productId: 'gpu-1',
    });
    // Trang không bắt buộc đăng nhập thì ở nguyên chỗ
    expect(screen.getByTestId('page')).toHaveTextContent('/products');
  });

  it('đổi trạng thái đăng nhập từ nơi khác thì nút cập nhật', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Đăng nhập' });
    localStorage.setItem('shop-ai:dev-token', 'dev');
    act(() => notifyAuthChanged());
    expect(await screen.findByRole('button', { name: 'Tài khoản của khachthu' })).toBeVisible();
  });
});
