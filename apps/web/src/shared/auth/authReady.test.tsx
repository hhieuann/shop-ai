// @vitest-environment jsdom
/**
 * #499: trước khi nối Cognito xong (main.tsx nạp gói Amplify song song), hỏi token phải chờ, để trang
 * bắt buộc đăng nhập không tưởng là khách rồi chuyển sang /login dù phiên còn. File riêng vì các ca
 * đổi bộ lấy token của token.ts (trạng thái của module).
 */
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setAuthReady, setProfileProvider, setTokenProvider } from './token';
import { useRequireSignIn } from './useRequireSignIn';
import { useAccount } from './useSession';

/** Lời hứa điều khiển được: giả gói Cognito nạp chậm */
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Guarded() {
  const session = useRequireSignIn();
  const { status } = useAccount();
  return (
    <p data-testid="state">
      {session} {status}
    </p>
  );
}

function LoginProbe() {
  const location = useLocation();
  return <pre data-testid="login-state">{JSON.stringify(location.state)}</pre>;
}

function renderAccount() {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<Guarded />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Đợi các lời hứa trong hàng chờ chạy hết */
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

afterEach(() => {
  cleanup();
  setAuthReady(Promise.resolve());
});

describe('#499 chờ nối Cognito xong rồi mới xét phiên', () => {
  it('staysLoading_andDoesNotRedirect_whileCognitoLoading', async () => {
    // Arrange: Cognito chưa nạp xong; bộ lấy token hiện tại (bản build) trả null
    const cognito = deferred();
    setTokenProvider(() => null);
    setAuthReady(cognito.promise);

    // Act
    renderAccount();
    await flush();

    // Assert: vẫn đang tải, không bị đẩy sang /login
    expect(screen.getByTestId('state')).toHaveTextContent('loading loading');
    expect(screen.queryByTestId('login-state')).toBeNull();
  });

  it('becomesSignedIn_whenCognitoReadyWithSession', async () => {
    // Arrange
    const cognito = deferred();
    setTokenProvider(() => null);
    setAuthReady(cognito.promise);
    renderAccount();
    await flush();

    // Act: Cognito nạp xong, phiên (cookie) còn
    setTokenProvider(() => 'access-token-thu');
    setProfileProvider(() => ({
      username: 'hoangnm',
      email: 'hoangnm@example.com',
      isAdmin: false,
    }));
    await act(async () => cognito.resolve());

    // Assert
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signedIn signedIn'));
    expect(screen.queryByTestId('login-state')).toBeNull();
  });

  it('redirectsToLogin_whenCognitoReadyWithoutSession', async () => {
    // Arrange
    const cognito = deferred();
    setTokenProvider(() => null);
    setAuthReady(cognito.promise);
    renderAccount();

    // Act: Cognito nạp xong, không có phiên
    await act(async () => cognito.resolve());

    // Assert: sang /login kèm from như cũ
    expect(await screen.findByTestId('login-state')).toHaveTextContent('{"from":"/account"}');
  });

  it('doesNotHang_whenCognitoFailsToLoad', async () => {
    // Arrange
    const cognito = deferred();
    setTokenProvider(() => null);
    setAuthReady(cognito.promise);
    renderAccount();

    // Act: nạp gói Cognito lỗi
    await act(async () => cognito.reject(new Error('chunk load failed')));

    // Assert: coi như xong, xét phiên bằng bộ lấy token đang có (không có token: sang /login)
    expect(await screen.findByTestId('login-state')).toHaveTextContent('{"from":"/account"}');
  });
});
