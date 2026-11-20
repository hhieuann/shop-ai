// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { notifyAuthChanged, signOut } from './token';
import { useRequireSignIn } from './useRequireSignIn';

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

function Guarded({ reason }: { reason?: string }) {
  const session = useRequireSignIn(reason ? { reason } : undefined);
  return <p data-testid="session">{session}</p>;
}

function LoginProbe() {
  const location = useLocation();
  return <pre data-testid="login-state">{JSON.stringify(location.state)}</pre>;
}

function renderAt(path = '/orders', reason?: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<Guarded reason={reason} />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function signedInAt(path = '/orders') {
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
  renderAt(path);
  await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('signedIn'));
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('useRequireSignIn', () => {
  it('redirectsToLoginWithFrom_whenGuest', async () => {
    // Act
    renderAt('/orders');

    // Assert
    expect(await screen.findByTestId('login-state')).toHaveTextContent('{"from":"/orders"}');
  });

  it('passesReason_whenGiven', async () => {
    // Act
    renderAt('/checkout', 'checkout');

    // Assert
    expect(await screen.findByTestId('login-state')).toHaveTextContent(
      '{"from":"/checkout","reason":"checkout"}',
    );
  });

  it('redirectsToLogin_whenTokenRevokedWhileOpen', async () => {
    // Arrange
    await signedInAt('/orders');

    // Act: token hết hạn hoặc bị thu hồi (không qua signOut)
    localStorage.removeItem(DEV_TOKEN_KEY);
    act(() => notifyAuthChanged());

    // Assert
    expect(await screen.findByTestId('login-state')).toHaveTextContent('{"from":"/orders"}');
  });

  it('staysOnPage_whenUserSignsOutWhileOpen', async () => {
    // Arrange
    await signedInAt('/orders');

    // Act: khách tự đăng xuất lúc trang đang mở (nơi gọi đăng xuất tự chuyển trang)
    await act(() => signOut());

    // Assert: phiên thành khách nhưng trang không tự sang /login
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('guest'));
    expect(screen.queryByTestId('login-state')).toBeNull();
  });

  it('redirectsToLogin_whenOpenedAfterSignOut', async () => {
    // Arrange: đã đăng xuất từ trước (số lần đăng xuất đã tăng)
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
    await signOut();

    // Act: mở trang bắt buộc đăng nhập
    renderAt('/orders');

    // Assert
    expect(await screen.findByTestId('login-state')).toHaveTextContent('{"from":"/orders"}');
  });
});
