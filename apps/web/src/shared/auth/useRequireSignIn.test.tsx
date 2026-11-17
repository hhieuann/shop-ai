// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { notifyAuthChanged } from './token';
import { useRequireSignIn } from './useRequireSignIn';

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

function Guarded({ leaving }: { leaving?: boolean }) {
  const session = useRequireSignIn(
    leaving === undefined ? undefined : { isLeaving: () => leaving },
  );
  return <p data-testid="session">{session}</p>;
}

function LoginProbe() {
  const location = useLocation();
  return <pre data-testid="login-state">{JSON.stringify(location.state)}</pre>;
}

function renderAt(leaving?: boolean) {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<Guarded leaving={leaving} />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('useRequireSignIn', () => {
  it('redirectsToLoginWithFrom_whenGuest', async () => {
    // Act
    renderAt();

    // Assert
    expect(await screen.findByTestId('login-state')).toHaveTextContent('{"from":"/account"}');
  });

  it('redirectsToLogin_whenSessionEndsAndNotLeaving', async () => {
    // Arrange
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
    renderAt(false);
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('signedIn'));

    // Act
    localStorage.removeItem(DEV_TOKEN_KEY);
    act(() => notifyAuthChanged());

    // Assert
    expect(await screen.findByTestId('login-state')).toBeInTheDocument();
  });

  it('staysOnPage_whenSessionEndsWhileLeaving', async () => {
    // Arrange: trang đang tự rời đi (đổi mật khẩu xong, pages/tai-khoan.md 3.2)
    localStorage.setItem(DEV_TOKEN_KEY, 'dev');
    renderAt(true);
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('signedIn'));

    // Act
    localStorage.removeItem(DEV_TOKEN_KEY);
    act(() => notifyAuthChanged());

    // Assert: phiên thành khách nhưng không bị đẩy sang /login
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('guest'));
    expect(screen.queryByTestId('login-state')).toBeNull();
  });
});
