// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { autoSignIn, confirmSignUp, signUp } from 'aws-amplify/auth';
import { continueAfterSignIn } from '../../cart/lib/afterSignIn';
import { RegisterPage } from './RegisterPage';

vi.mock('aws-amplify/auth', () => ({
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
  autoSignIn: vi.fn(),
}));
vi.mock('../../../shared/auth/cognito', () => ({ initAuth: vi.fn(async () => 'cognito') }));
vi.mock('../../cart/lib/afterSignIn', () => ({ continueAfterSignIn: vi.fn() }));

function renderRegister() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/register', state: { from: '/cart' } }]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillForm(values: {
  username: string;
  email: string;
  password: string;
  confirm?: string;
}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Username'), values.username);
  await user.type(screen.getByLabelText('Email'), values.email);
  await user.type(screen.getByLabelText('Mật khẩu'), values.password);
  await user.type(screen.getByLabelText('Nhập lại mật khẩu'), values.confirm ?? values.password);
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  return user;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('RegisterPage', () => {
  it('passwordRules_markEachConditionAsTyped', async () => {
    // Arrange
    renderRegister();

    // Act
    await userEvent.setup().type(screen.getByLabelText('Mật khẩu'), 'abcdefgh');

    // Assert: đủ 8 ký tự, có chữ thường; còn thiếu hoa, số, ký tự đặc biệt
    expect(screen.getByText('Ít nhất 8 ký tự')).toHaveTextContent('(đã đạt)');
    expect(screen.getByText('Có chữ hoa')).toHaveTextContent('(chưa đạt)');
  });

  it('submit_blocksBeforeCognito_whenPasswordsDiffer', async () => {
    // Arrange
    renderRegister();

    // Act
    await fillForm({
      username: 'an_nguyen',
      email: 'an@example.com',
      password: 'Abcdef1!',
      confirm: 'Abcdef1?',
    });

    // Assert
    expect(await screen.findByText('Mật khẩu nhập lại không khớp.')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('submit_signsUpWithUsernameThenConfirmsAndSignsIn', async () => {
    // Arrange
    vi.mocked(signUp).mockResolvedValue({
      isSignUpComplete: false,
      nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
    } as never);
    vi.mocked(confirmSignUp).mockResolvedValue({
      isSignUpComplete: true,
      nextStep: { signUpStep: 'COMPLETE_AUTO_SIGN_IN' },
    } as never);
    vi.mocked(autoSignIn).mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    renderRegister();

    // Act
    const user = await fillForm({
      username: 'an_nguyen',
      email: 'an@example.com',
      password: 'Abcdef1!',
    });
    expect(await screen.findByRole('heading', { name: 'Xác nhận email' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mã xác nhận'), '654321');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    // Assert: đăng nhập luôn, khách không phải gõ lại (dang-nhap.md §1)
    await waitFor(() => expect(continueAfterSignIn).toHaveBeenCalledTimes(1));
    expect(signUp).toHaveBeenCalledWith({
      username: 'an@example.com',
      password: 'Abcdef1!',
      options: {
        userAttributes: { email: 'an@example.com', preferred_username: 'an_nguyen' },
        autoSignIn: true,
      },
    });
    expect(confirmSignUp).toHaveBeenCalledWith({
      username: 'an@example.com',
      confirmationCode: '654321',
    });
    expect(autoSignIn).toHaveBeenCalledTimes(1);
  });

  it('submit_showsUsernameError_whenPreSignUpRejectsTaken', async () => {
    // Arrange
    vi.mocked(signUp).mockRejectedValue(
      Object.assign(new Error('PreSignUp failed with error USERNAME_TAKEN.'), {
        name: 'UserLambdaValidationException',
      }),
    );
    renderRegister();

    // Act
    await fillForm({ username: 'an_nguyen', email: 'an@example.com', password: 'Abcdef1!' });

    // Assert
    expect(await screen.findByText('Username này đã có người dùng.')).toBeInTheDocument();
  });
});
