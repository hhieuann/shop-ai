// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { confirmResetPassword, resetPassword } from 'aws-amplify/auth';
import { ForgotPasswordPage } from './ForgotPasswordPage';

vi.mock('aws-amplify/auth', () => ({
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
}));
vi.mock('../../../shared/auth/cognito', () => ({
  initAuth: vi.fn(async () => 'cognito'),
  authMode: () => 'cognito',
}));

const cognitoError = (name: string) => Object.assign(new Error(name), { name });
const NEW_PASSWORD = 'Moi12345!';

/** Trang /login giả: in state nhận được để kiểm hợp đồng giữa hai trang */
function LoginProbe() {
  const location = useLocation();
  return <pre data-testid="login-state">{JSON.stringify(location.state)}</pre>;
}

function renderPage(state: object = { from: '/cart', reason: 'checkout' }) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/forgot-password', state }]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function goToResetStep(email = 'an@example.com') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Gửi mã' }));
  await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' });
  return user;
}

async function fillReset(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.type(screen.getByLabelText('Mã xác nhận'), code);
  await user.type(screen.getByLabelText('Mật khẩu mới'), NEW_PASSWORD);
  await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), NEW_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resetPassword).mockResolvedValue({
    isPasswordReset: false,
    nextStep: {
      resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE',
      codeDeliveryDetails: { deliveryMedium: 'EMAIL', destination: 'a***@e***' },
    },
  });
});
afterEach(cleanup);

describe('ForgotPasswordPage', () => {
  it('sendCode_showsEmailError_withoutCallingCognito_whenEmailInvalid', async () => {
    // Arrange
    renderPage();
    const user = userEvent.setup();

    // Act
    await user.type(screen.getByLabelText('Email'), 'an@example');
    await user.click(screen.getByRole('button', { name: 'Gửi mã' }));

    // Assert
    expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument();
    // Verify
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('sendCode_prefillsEmail_fromLoginState', () => {
    // Arrange
    renderPage({ from: '/cart', email: 'an@example.com' });

    // Assert
    expect(screen.getByLabelText('Email')).toHaveValue('an@example.com');
  });

  it('sendCode_goesToResetStepWithNeutralText', async () => {
    // Arrange
    renderPage();

    // Act
    await goToResetStep('  an@example.com ');

    // Assert: không nói email có tài khoản hay không (account.md BR-13)
    expect(screen.getByText(/có tài khoản, mã 6 số đã được gửi tới email này/)).toHaveTextContent(
      'Nếu an@example.com có tài khoản',
    );
    // Verify
    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(resetPassword).toHaveBeenCalledWith({ username: 'an@example.com' });
  });

  it('code_doesNotSubmit_andFocusesNewPassword_whenSixDigitsTyped', async () => {
    // Arrange
    renderPage();
    const user = await goToResetStep();

    // Act
    await user.type(screen.getByLabelText('Mã xác nhận'), '123456');

    // Assert: Cognito chỉ kiểm mã cùng mật khẩu mới, nên không tự gửi
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveFocus();
    // Verify
    expect(confirmResetPassword).not.toHaveBeenCalled();
  });

  it('reset_showsFieldErrors_withoutCallingCognito_whenInputInvalid', async () => {
    // Arrange
    renderPage();
    const user = await goToResetStep();

    // Act
    await user.type(screen.getByLabelText('Mã xác nhận'), '123');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'abc');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'abd');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    // Assert
    expect(await screen.findByText('Nhập đủ 6 số trong email.')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu chưa đạt điều kiện bên dưới.')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeInTheDocument();
    // Verify
    expect(confirmResetPassword).not.toHaveBeenCalled();
  });

  it('reset_goesToLoginWithEmailAndNotice_whenCodeCorrect', async () => {
    // Arrange
    vi.mocked(confirmResetPassword).mockResolvedValue();
    renderPage({ from: '/cart', reason: 'checkout' });
    const user = await goToResetStep();

    // Act
    await fillReset(user, '123456');

    // Assert: về /login, giữ from, reason, kèm email và thông báo (dang-nhap.md §3.4)
    const state = JSON.parse((await screen.findByTestId('login-state')).textContent ?? 'null');
    expect(state).toEqual({
      from: '/cart',
      reason: 'checkout',
      email: 'an@example.com',
      notice: 'Đã đặt mật khẩu mới. Đăng nhập bằng mật khẩu mới.',
    });
    // Verify
    expect(confirmResetPassword).toHaveBeenCalledTimes(1);
    expect(confirmResetPassword).toHaveBeenCalledWith({
      username: 'an@example.com',
      confirmationCode: '123456',
      newPassword: NEW_PASSWORD,
    });
  });

  it('reset_clearsCodeKeepsPassword_andRefocuses_whenCodeWrong', async () => {
    // Arrange
    vi.mocked(confirmResetPassword).mockRejectedValue(cognitoError('CodeMismatchException'));
    renderPage();
    const user = await goToResetStep();

    // Act
    await fillReset(user, '654321');

    // Assert
    expect(
      await screen.findByText('Mã không đúng. Kiểm tra lại email mới nhất.'),
    ).toBeInTheDocument();
    const code = screen.getByLabelText('Mã xác nhận');
    expect(code).toHaveValue('');
    expect(code).toHaveFocus();
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue(NEW_PASSWORD);
    expect(screen.getByLabelText('Nhập lại mật khẩu mới')).toHaveValue(NEW_PASSWORD);
    // Verify
    expect(screen.queryByTestId('login-state')).not.toBeInTheDocument();
  });

  it('reset_showsExpiredMessage_whenCodeExpired', async () => {
    // Arrange
    vi.mocked(confirmResetPassword).mockRejectedValue(cognitoError('ExpiredCodeException'));
    renderPage();
    const user = await goToResetStep();

    // Act
    await fillReset(user, '654321');

    // Assert
    expect(await screen.findByText('Mã đã hết hạn. Bấm Gửi lại mã.')).toBeInTheDocument();
  });

  it('reset_showsErrorUnderNewPassword_whenCognitoRejectsPassword', async () => {
    // Arrange
    vi.mocked(confirmResetPassword).mockRejectedValue(cognitoError('InvalidPasswordException'));
    renderPage();
    const user = await goToResetStep();

    // Act
    await fillReset(user, '123456');

    // Assert
    expect(await screen.findByText('Mật khẩu chưa đạt điều kiện bên dưới.')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute('aria-invalid', 'true');
  });

  it('reset_showsTooManyAttempts_whenLimitExceeded', async () => {
    // Arrange
    vi.mocked(confirmResetPassword).mockRejectedValue(cognitoError('LimitExceededException'));
    renderPage();
    const user = await goToResetStep();

    // Act
    await fillReset(user, '123456');

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
    );
  });

  it('reset_doesNotBlameEmailOrPassword_whenNotAuthorized', async () => {
    // Arrange
    vi.mocked(confirmResetPassword).mockRejectedValue(cognitoError('NotAuthorizedException'));
    renderPage();
    const user = await goToResetStep();

    // Act
    await fillReset(user, '123456');

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không đặt lại được mật khẩu cho tài khoản này.');
    expect(alert).not.toHaveTextContent('Email hoặc mật khẩu không đúng.');
  });

  it('resend_sendsNewCode_clearsCode_andKeepsPassword', async () => {
    // Arrange
    renderPage();
    const user = await goToResetStep();
    await user.type(screen.getByLabelText('Mã xác nhận'), '12');
    await user.type(screen.getByLabelText('Mật khẩu mới'), NEW_PASSWORD);

    // Act
    await user.click(screen.getByRole('button', { name: 'Gửi lại mã' }));

    // Assert
    expect(await screen.findByText('Đã gửi mã mới.')).toBeInTheDocument();
    const code = screen.getByLabelText('Mã xác nhận');
    expect(code).toHaveValue('');
    expect(code).toHaveFocus();
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue(NEW_PASSWORD);
    // Verify
    expect(resetPassword).toHaveBeenCalledTimes(2);
  });

  it('changeEmail_returnsToFirstStep_keepingEmail', async () => {
    // Arrange
    renderPage();
    const user = await goToResetStep();

    // Act
    await user.click(screen.getByRole('button', { name: 'Nhập lại email' }));

    // Assert
    expect(screen.getByRole('heading', { name: 'Đặt lại mật khẩu' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('an@example.com');
  });

  it('tab_followsSpecOrder_onResetStep', async () => {
    // Arrange
    renderPage();
    const user = await goToResetStep();
    await user.click(screen.getByLabelText('Mã xác nhận'));

    // Act + Assert: ô mã → mật khẩu mới → nhập lại → gửi → gửi lại mã → nhập lại email
    await user.tab();
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Nhập lại mật khẩu mới')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Đặt lại mật khẩu' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Gửi lại mã' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Nhập lại email' })).toHaveFocus();
  });

  it('loginLink_keepsFromReasonAndEmail', async () => {
    // Arrange
    renderPage({ from: '/cart', reason: 'checkout' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'an@example.com');

    // Act
    await user.click(screen.getByRole('link', { name: 'Đăng nhập' }));

    // Assert
    const state = JSON.parse((await screen.findByTestId('login-state')).textContent ?? 'null');
    expect(state).toEqual({ from: '/cart', reason: 'checkout', email: 'an@example.com' });
  });
});
