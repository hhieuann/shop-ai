// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { confirmSignIn, resendSignUpCode, signIn } from 'aws-amplify/auth';
import { continueAfterSignIn } from '../../cart/lib/afterSignIn';
import { LoginPage } from './LoginPage';

vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  confirmSignIn: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
}));
vi.mock('../../../shared/auth/cognito', () => ({
  initAuth: vi.fn(async () => 'cognito'),
  authMode: () => 'cognito',
}));
vi.mock('../../cart/lib/afterSignIn', () => ({ continueAfterSignIn: vi.fn() }));

const cognitoError = (name: string) => Object.assign(new Error(name), { name });

function renderLogin(state: object = { from: '/cart', reason: 'checkout' }) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<p data-testid="register">register</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Mật khẩu'), password);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  return user;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('LoginPage', () => {
  it('submit_showsFieldErrors_withoutCallingCognito_whenEmailInvalid', async () => {
    // Arrange
    renderLogin();

    // Act
    await fillAndSubmit('an@example', 'Abcdef1!');

    // Assert
    expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('submit_signsInAndHandsOverToCart_whenCredentialsCorrect', async () => {
    // Arrange
    vi.mocked(signIn).mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    renderLogin();

    // Act
    await fillAndSubmit('an@example.com', 'Abcdef1!');

    // Assert: giỏ hàng quyết đi tiếp (dang-nhap.md §1), trang không tự navigate
    await waitFor(() => expect(continueAfterSignIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith({ username: 'an@example.com', password: 'Abcdef1!' });
    expect(vi.mocked(continueAfterSignIn).mock.calls[0]?.[2]).toBe('/cart');
  });

  it('submit_showsGenericAlert_whenEmailOrPasswordWrong', async () => {
    // Arrange
    vi.mocked(signIn).mockRejectedValue(cognitoError('NotAuthorizedException'));
    renderLogin();

    // Act
    await fillAndSubmit('an@example.com', 'Sai1!sai');

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.');
    expect(continueAfterSignIn).not.toHaveBeenCalled();
  });

  it('submit_asksForTotpCode_whenAccountHasMfa', async () => {
    // Arrange
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' },
    } as never);
    vi.mocked(confirmSignIn).mockResolvedValue({
      isSignedIn: true,
      nextStep: { signInStep: 'DONE' },
    });
    renderLogin();

    // Act
    const user = await fillAndSubmit('admin@example.com', 'Abcdef1!');
    expect(await screen.findByRole('heading', { name: 'Xác thực hai lớp' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mã xác thực'), '123456');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    // Assert
    await waitFor(() => expect(continueAfterSignIn).toHaveBeenCalledTimes(1));
    expect(confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '123456' });
    expect(screen.queryByRole('button', { name: 'Gửi lại mã' })).not.toBeInTheDocument();
  });

  it('submit_switchesToConfirmEmailAndResendsCode_whenAccountNotConfirmed', async () => {
    // Arrange
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_UP' },
    } as never);
    renderLogin();

    // Act
    await fillAndSubmit('an@example.com', 'Abcdef1!');

    // Assert
    expect(await screen.findByRole('heading', { name: 'Xác nhận email' })).toBeInTheDocument();
    expect(resendSignUpCode).toHaveBeenCalledWith({ username: 'an@example.com' });
  });

  it('registerLink_keepsFromAndReason', async () => {
    // Arrange
    renderLogin({ from: '/cart', reason: 'checkout' });

    // Assert: câu giải thích khi đến từ nút "Đặt hàng"
    expect(screen.getByText(/Các sản phẩm bạn đã chọn được giữ nguyên/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Tạo tài khoản' }));
    expect(await screen.findByTestId('register')).toBeInTheDocument();
  });
});
