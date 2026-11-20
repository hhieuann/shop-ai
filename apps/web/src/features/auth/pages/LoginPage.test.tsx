// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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
// Giữ bản thật của phần còn lại (clearCartSession: đăng xuất máy này khi còn phiên cũ, #501)
vi.mock('../../cart/lib/afterSignIn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../cart/lib/afterSignIn')>()),
  continueAfterSignIn: vi.fn(),
}));

const cognitoError = (name: string) => Object.assign(new Error(name), { name });

/** Trang /forgot-password giả: in state nhận được */
function ForgotProbe() {
  const location = useLocation();
  return <pre data-testid="forgot-state">{JSON.stringify(location.state)}</pre>;
}

function renderLogin(state: object = { from: '/cart', reason: 'checkout' }) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<p data-testid="register">register</p>} />
          <Route path="/forgot-password" element={<ForgotProbe />} />
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
    // Dòng gợi ý dưới ô mã, nối vào ô (dang-nhap.md 3.1, thêm 18/11)
    expect(screen.getByLabelText('Mã xác thực')).toHaveAccessibleDescription(
      'Mã trong ứng dụng xác thực của bạn',
    );
    // Gõ đủ 6 số là tự gửi, không bấm "Xác nhận"
    await user.type(screen.getByLabelText('Mã xác thực'), '123456');

    // Assert
    await waitFor(() => expect(continueAfterSignIn).toHaveBeenCalledTimes(1));
    expect(confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '123456' });
    expect(screen.queryByRole('button', { name: 'Gửi lại mã' })).not.toBeInTheDocument();
    // Verify
    expect(confirmSignIn).toHaveBeenCalledTimes(1);
  });

  it('confirm_asksForSixDigits_whenTotpCodeShort', async () => {
    // Arrange
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' },
    } as never);
    renderLogin();
    const user = await fillAndSubmit('admin@example.com', 'Abcdef1!');
    await screen.findByRole('heading', { name: 'Xác thực hai lớp' });

    // Act
    await user.type(screen.getByLabelText('Mã xác thực'), '123');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    // Assert
    expect(await screen.findByText('Nhập đủ 6 số trong ứng dụng xác thực.')).toBeInTheDocument();
    // Verify
    expect(confirmSignIn).not.toHaveBeenCalled();
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

describe('LoginPage · bàn phím (#432)', () => {
  it('tab_goesFromPasswordStraightToSubmit_skippingShowPasswordButton', async () => {
    // Arrange
    const user = userEvent.setup();
    renderLogin();
    screen.getByLabelText('Email').focus();

    // Act + Assert: Email → Mật khẩu → nút "Đăng nhập", không dừng ở nút con mắt
    await user.tab();
    expect(screen.getByLabelText('Mật khẩu')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toHaveFocus();
  });

  it('enterInPassword_submitsForm', async () => {
    // Arrange
    vi.mocked(signIn).mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email'), 'an@example.com');

    // Act: gõ mật khẩu rồi Enter ngay trong ô
    await user.type(screen.getByLabelText('Mật khẩu'), 'Abcdef1!{Enter}');

    // Verify
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith({ username: 'an@example.com', password: 'Abcdef1!' });
  });
});

describe('LoginPage · quên mật khẩu (#439)', () => {
  it('forgotLink_keepsFromReasonAndTypedEmail', async () => {
    // Arrange
    const user = userEvent.setup();
    renderLogin({ from: '/cart', reason: 'checkout' });
    await user.type(screen.getByLabelText('Email'), ' an@example.com ');

    // Act
    await user.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }));

    // Assert
    const state = JSON.parse((await screen.findByTestId('forgot-state')).textContent ?? 'null');
    expect(state).toEqual({ from: '/cart', reason: 'checkout', email: 'an@example.com' });
  });

  it('tab_reachesSubmitBeforeForgotLink', async () => {
    // Arrange
    const user = userEvent.setup();
    renderLogin();
    screen.getByLabelText('Mật khẩu').focus();

    // Act + Assert: Mật khẩu → "Đăng nhập" → "Quên mật khẩu?" (dang-nhap.md §3.1)
    await user.tab();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Quên mật khẩu?' })).toHaveFocus();
  });

  it('notice_prefillsEmail_showsSuccess_andFocusesPassword', async () => {
    // Arrange + Act: quay về sau khi đặt lại mật khẩu (§3.4)
    renderLogin({
      from: '/cart',
      email: 'an@example.com',
      notice: 'Đã đặt mật khẩu mới. Đăng nhập bằng mật khẩu mới.',
    });

    // Assert
    expect(screen.getByLabelText('Email')).toHaveValue('an@example.com');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Đã đặt mật khẩu mới. Đăng nhập bằng mật khẩu mới.',
    );
    await waitFor(() => expect(screen.getByLabelText('Mật khẩu')).toHaveFocus());
  });

  it('notice_isNotForwarded_toOtherAuthPages', async () => {
    // Arrange
    const user = userEvent.setup();
    renderLogin({ from: '/cart', email: 'an@example.com', notice: 'Đã đặt mật khẩu mới.' });

    // Act
    await user.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }));

    // Assert: thông báo chỉ hiện một lần ở /login, không mang sang trang khác
    const state = JSON.parse((await screen.findByTestId('forgot-state')).textContent ?? 'null');
    expect(state).toEqual({ from: '/cart', email: 'an@example.com' });
  });
});

/** #501: máy còn phiên cũ (có thể của người khác) thì không dùng phiên đó */
describe('LoginPage · máy còn phiên cũ', () => {
  const DEV_TOKEN_KEY = 'shop-ai:dev-token';
  /** Token giả còn trong máy lúc mỗi lần gọi signIn (đăng xuất phải chạy giữa hai lần) */
  let tokensSeen: (string | null)[];

  beforeEach(() => {
    localStorage.clear();
    tokensSeen = [];
  });

  /**
   * Form đã hiện (trang chưa thấy phiên lúc mở, vd. bấm khi đang nạp Cognito hoặc làm mới token lỗi),
   * nhưng máy vẫn còn phiên cũ của người khác (token giả của bản mock)
   */
  async function renderWithOldSession() {
    renderLogin();
    await screen.findByLabelText('Mật khẩu');
    localStorage.setItem(DEV_TOKEN_KEY, 'phien-cu');
  }

  /** signIn lần 1 báo đã đăng nhập; lần 2 chạy `second` */
  function mockAlreadyAuthenticatedThen(second: () => Promise<unknown>) {
    vi.mocked(signIn).mockImplementation(async () => {
      tokensSeen.push(localStorage.getItem(DEV_TOKEN_KEY));
      if (tokensSeen.length === 1) throw cognitoError('UserAlreadyAuthenticatedException');
      return second() as never;
    });
  }

  it('submit_signsOutOldSessionThenSignsInAgain_withTypedCredentials', async () => {
    // Arrange
    mockAlreadyAuthenticatedThen(async () => ({
      isSignedIn: true,
      nextStep: { signInStep: 'DONE' },
    }));
    await renderWithOldSession();

    // Act
    await fillAndSubmit('binh@example.com', 'Abcdef1!');

    // Assert: đăng nhập bằng tài khoản vừa nhập, không dùng phiên cũ
    await waitFor(() => expect(continueAfterSignIn).toHaveBeenCalledTimes(1));
    // Verify: hai lần cùng email, mật khẩu; phiên cũ đã xoá trước lần thứ hai
    expect(vi.mocked(signIn).mock.calls).toEqual([
      [{ username: 'binh@example.com', password: 'Abcdef1!' }],
      [{ username: 'binh@example.com', password: 'Abcdef1!' }],
    ]);
    expect(tokensSeen).toEqual(['phien-cu', null]);
  });

  it('submit_showsWrongPassword_andDoesNotFinish_whenOldSessionAndPasswordWrong', async () => {
    // Arrange: trước đây nhập mật khẩu nào cũng vào bằng phiên cũ
    mockAlreadyAuthenticatedThen(async () => {
      throw cognitoError('NotAuthorizedException');
    });
    await renderWithOldSession();

    // Act
    await fillAndSubmit('binh@example.com', 'Sai1!sai');

    // Assert: báo sai như BR-07, không vào, phiên cũ đã bị xoá khỏi máy
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.');
    expect(continueAfterSignIn).not.toHaveBeenCalled();
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });

  it('submit_showsReloadAlert_andTriesOnlyOnce_whenStillAuthenticated', async () => {
    // Arrange: xoá phiên cũ không được, lần hai Cognito vẫn báo đã đăng nhập
    mockAlreadyAuthenticatedThen(async () => {
      throw cognitoError('UserAlreadyAuthenticatedException');
    });
    await renderWithOldSession();

    // Act
    await fillAndSubmit('binh@example.com', 'Abcdef1!');

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không đăng xuất được phiên cũ trên máy này. Vui lòng tải lại trang rồi đăng nhập lại.',
    );
    // Verify: không vào, không lặp
    expect(continueAfterSignIn).not.toHaveBeenCalled();
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it('submit_asksForTotpCode_whenRetryNeedsMfa', async () => {
    // Arrange: tài khoản vừa nhập có bật xác thực hai lớp
    mockAlreadyAuthenticatedThen(async () => ({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' },
    }));
    await renderWithOldSession();

    // Act
    await fillAndSubmit('binh@example.com', 'Abcdef1!');

    // Assert: vẫn phải nhập mã, không bỏ qua bước MFA
    expect(await screen.findByRole('heading', { name: 'Xác thực hai lớp' })).toBeInTheDocument();
    expect(continueAfterSignIn).not.toHaveBeenCalled();
  });
});
