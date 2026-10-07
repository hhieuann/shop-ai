// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AccountMenu />
      <Routes>
        <Route path="*" element={<p data-testid="page">{path}</p>} />
        <Route path="/" element={<p data-testid="page">home</p>} />
      </Routes>
    </MemoryRouter>,
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

  it('đăng xuất ở trang bắt buộc đăng nhập thì về trang chủ, giữ giỏ khách', async () => {
    localStorage.setItem('shop-ai:dev-token', 'dev');
    localStorage.setItem('shop-ai:guest-cart', '[]');
    const user = userEvent.setup();
    renderAt('/orders');

    await user.click(await screen.findByRole('button', { name: /Tài khoản của/ }));
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('home'));
    expect(localStorage.getItem('shop-ai:dev-token')).toBeNull();
    expect(localStorage.getItem('shop-ai:guest-cart')).toBe('[]');
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('đổi trạng thái đăng nhập từ nơi khác thì nút cập nhật', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Đăng nhập' });
    localStorage.setItem('shop-ai:dev-token', 'dev');
    act(() => notifyAuthChanged());
    expect(await screen.findByRole('button', { name: 'Tài khoản của khachthu' })).toBeVisible();
  });
});
