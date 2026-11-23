// @vitest-environment jsdom
/**
 * #487: đăng xuất ở trang bắt buộc đăng nhập phải về / (design-system §9.17), không bị trang đó đẩy sang
 * /login. Dựng router dữ liệu có route lazy như router.tsx: lỗi gốc chỉ lộ khi chuyển trang phải chờ tải
 * code trang (trang cũ còn mounted lúc phiên vừa hết).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { AccountMenu } from '../../../app/AccountMenu';
import { changePassword, getSignOutCount, notifyAuthChanged } from '../../../shared/auth/token';
import { useRequireSignIn } from '../../../shared/auth/useRequireSignIn';
import { useSignOut } from './useSignOut';

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

/**
 * Lần render đầu của file phải nạp code AccountMenu, trang tài khoản lần đầu; trên CI mất hơn 1 giây (mức chờ
 * mặc định của findBy) nên ca chạy đầu đỏ ngẫu nhiên. Chỉ nới cho lần chờ nút tài khoản đầu tiên.
 */
const FIRST_RENDER = { timeout: 5000 };

beforeAll(() => {
  // jsdom không có ResizeObserver và matchMedia (AccountMenu dùng)
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

/** Route lazy: chờ như tải code trang */
const lazyPage = (Component: () => ReactElement) => async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { Component };
};

function Where() {
  const location = useLocation();
  return (
    <pre data-testid="where">
      {location.pathname} {JSON.stringify(location.state)}
    </pre>
  );
}

function Guarded({ reason }: { reason?: string }) {
  useRequireSignIn(reason ? { reason } : undefined);
  return <Where />;
}

/** Trang đổi mật khẩu giả: đổi xong đăng xuất mọi nơi rồi sang /login kèm email, câu báo */
const RESET_STATE = {
  email: 'khachthu@example.com',
  from: '/account',
  notice: 'Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.',
};
let lastError = '';
function FakeChangePassword() {
  useRequireSignIn();
  const signOutAndLeave = useSignOut();
  return (
    <>
      <Where />
      <button
        type="button"
        onClick={() =>
          void signOutAndLeave({ global: true, to: '/login', state: RESET_STATE }).catch(
            (e: Error) => {
              lastError = e.name;
            },
          )
        }
      >
        Đăng xuất mọi nơi
      </button>
    </>
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <AccountMenu />
            <Outlet />
          </>
        ),
        HydrateFallback: () => null,
        children: [
          { index: true, lazy: lazyPage(() => <Where />) },
          { path: 'login', lazy: lazyPage(() => <Where />) },
          { path: 'orders', lazy: lazyPage(() => <Guarded />) },
          { path: 'checkout', lazy: lazyPage(() => <Guarded reason="checkout" />) },
          { path: 'admin', lazy: lazyPage(() => <Guarded />) },
          {
            path: 'account',
            lazy: async () => ({
              Component: (await import('../components/AccountLayout')).AccountLayout,
            }),
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('../pages/AccountInfoPage')).AccountInfoPage,
                }),
              },
              { path: 'password', lazy: lazyPage(() => <FakeChangePassword />) },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup() };
}

/** Đợi thêm một lúc để chắc không có lần chuyển trang nào chen sau */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 150)));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  lastError = '';
});
afterEach(cleanup);

describe('#487 đăng xuất ở trang bắt buộc đăng nhập', () => {
  it.each(['/orders', '/checkout', '/admin', '/account'])(
    'headerSignOut_goesHome_on %s',
    async (path) => {
      // Arrange
      localStorage.setItem(DEV_TOKEN_KEY, 'dev');
      const { router, user } = renderAt(path);
      await user.click(await screen.findByRole('button', { name: /Tài khoản của/ }, FIRST_RENDER));

      // Act
      await user.click(
        within(screen.getByRole('dialog', { name: 'Xin chào,' })).getByRole('button', {
          name: 'Đăng xuất',
        }),
      );

      // Assert: về /, không bị đẩy sang /login
      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
      await settle();
      expect(router.state.location.pathname).toBe('/');
      expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
    },
  );

  it('changePasswordDone_goesToLoginWithEmailAndNotice', async () => {
    // Arrange
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
    const { router, user } = renderAt('/account/password');

    // Act
    await user.click(await screen.findByRole('button', { name: 'Đăng xuất mọi nơi' }));

    // Assert: tới /login kèm đủ email, from, câu báo (không bị đè thành chỉ { from })
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await settle();
    expect(router.state.location.state).toEqual(RESET_STATE);
  });

  it('tokenRevokedOnOrders_goesToLoginWithFrom', async () => {
    // Arrange
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
    const { router } = renderAt('/orders');
    await screen.findByTestId('where');

    // Act: token hết hạn hoặc bị thu hồi, không qua signOut
    localStorage.removeItem(DEV_TOKEN_KEY);
    act(() => notifyAuthChanged());

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.state).toEqual({ from: '/orders' });
  });

  it('openOrdersAfterSignOut_goesToLogin', async () => {
    // Arrange: đăng xuất ở /products (trang công khai)
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
    const { router, user } = renderAt('/');
    await user.click(await screen.findByRole('button', { name: /Tài khoản của/ }, FIRST_RENDER));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Xin chào,' })).getByRole('button', {
        name: 'Đăng xuất',
      }),
    );
    await waitFor(() => expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull());

    // Act: mở /orders khi đã là khách
    await act(() => router.navigate('/orders'));

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.state).toEqual({ from: '/orders' });
  });

  it('globalSignOutFails_countUnchanged_thenExpiryGoesToLogin', async () => {
    // Arrange: bản mock, mật khẩu mới chứa "loimang" thì lần đăng xuất mọi nơi kế tiếp lỗi
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
    await changePassword('Cu12345!', 'Moi-loimang-1A!');
    const before = getSignOutCount();
    const { router, user } = renderAt('/account/password');

    // Act: đăng xuất mọi nơi lỗi
    await user.click(await screen.findByRole('button', { name: 'Đăng xuất mọi nơi' }));
    await waitFor(() => expect(lastError).toBe('NetworkError'));

    // Assert: số lần đăng xuất không tăng, còn đăng nhập, ở lại trang
    expect(getSignOutCount()).toBe(before);
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBe('dev');
    expect(router.state.location.pathname).toBe('/account/password');

    // Act: sau đó phiên hết hạn trên trang này
    localStorage.removeItem(DEV_TOKEN_KEY);
    act(() => notifyAuthChanged());

    // Assert: sang /login như phiên hết hạn
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.state).toEqual({ from: '/account/password' });
  });
});
