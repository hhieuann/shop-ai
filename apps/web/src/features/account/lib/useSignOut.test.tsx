// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { queryKeys } from '../../../shared/api/queryKeys';
import * as token from '../../../shared/auth/token';
import { useSignOut, type SignOutAndLeaveOptions } from './useSignOut';

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

function Trigger({ options }: { options?: SignOutAndLeaveOptions }) {
  const signOutAndLeave = useSignOut();
  const location = useLocation();
  return (
    <>
      <button
        type="button"
        onClick={() => void signOutAndLeave(options).catch((e: Error) => setError(e.name))}
      >
        Đăng xuất
      </button>
      <p data-testid="where">{location.pathname}</p>
      <pre data-testid="state">{JSON.stringify(location.state)}</pre>
    </>
  );
}

let lastError: string | null = null;
const setError = (name: string) => {
  lastError = name;
};

function renderAt(path: string, options?: SignOutAndLeaveOptions, queryClient = new QueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Trigger options={options} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
  lastError = null;
});
afterEach(cleanup);

describe('useSignOut', () => {
  it('goesHome_whenOnSignedInOnlyPage', async () => {
    // Arrange
    const { user } = renderAt('/account/password');

    // Act
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    // Assert
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/));
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });

  it('staysOnPage_whenPageIsPublic', async () => {
    // Arrange
    const { user } = renderAt('/products');

    // Act
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    // Assert
    await waitFor(() => expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull());
    expect(screen.getByTestId('where')).toHaveTextContent('/products');
  });

  it('goesToTargetWithState_whenGiven', async () => {
    // Arrange
    const state = { email: 'khachthu@example.com', from: '/account', notice: 'Đã đổi mật khẩu.' };
    const { user } = renderAt('/account/password', { global: true, to: '/login', state });

    // Act
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    // Assert
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/login'));
    expect(screen.getByTestId('state')).toHaveTextContent(JSON.stringify(state));
  });

  it('globalFailure_throwsAndKeepsSessionAndData', async () => {
    // Arrange
    // bản mock: mật khẩu mới chứa "loimang" thì lần đăng xuất mọi nơi kế tiếp lỗi
    await token.changePassword('Cu12345!', 'Moi-loimang-1A!');
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.orders.all, ['đơn của khách']);
    const { user } = renderAt('/account/password', { global: true, to: '/login' }, queryClient);

    // Act
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    // Assert: báo lỗi, ở lại trang, giữ phiên và dữ liệu để thử lại
    await waitFor(() => expect(lastError).toBe('NetworkError'));
    expect(screen.getByTestId('where')).toHaveTextContent('/account/password');
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBe('dev');
    expect(queryClient.getQueryData(queryKeys.orders.all)).toEqual(['đơn của khách']);
  });

  it('clearsSessionCaches_afterSignOut', async () => {
    // Arrange
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.orders.all, ['đơn']);
    queryClient.setQueryData(queryKeys.recs.all, ['gợi ý']);
    queryClient.setQueryData(queryKeys.admin.all, ['admin']);
    const { user } = renderAt('/products', undefined, queryClient);

    // Act
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    // Assert
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.orders.all)).toBeUndefined());
    expect(queryClient.getQueryData(queryKeys.recs.all)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.admin.all)).toBeUndefined();
  });
});
