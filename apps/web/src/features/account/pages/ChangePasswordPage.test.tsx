// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { changePassword } from '../../../shared/auth/token';
import { AccountLayout } from '../components/AccountLayout';
import { ChangePasswordPage } from './ChangePasswordPage';

// Bản mock của shared/auth/token.ts (token giả): mật khẩu hiện tại "sai" → NotAuthorizedException,
// "nhieu" → LimitExceededException; mật khẩu mới chứa "loimang" → đăng xuất mọi nơi lỗi một lần
const DEV_TOKEN_KEY = 'shop-ai:dev-token';

// Giữ bản thật của token.ts; chỉ bọc changePassword để một ca giả được lỗi Cognito mà mock không có
vi.mock('../../../shared/auth/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/auth/token')>();
  return { ...actual, changePassword: vi.fn(actual.changePassword) };
});
const CURRENT = 'Cu12345!';
const NEW = 'Moi12345!';

function LoginProbe() {
  const location = useLocation();
  return <pre data-testid="login-state">{JSON.stringify(location.state)}</pre>;
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/account/password']}>
        <Routes>
          <Route path="/account" element={<AccountLayout />}>
            <Route path="password" element={<ChangePasswordPage />} />
          </Route>
          <Route path="/forgot-password" element={<h1>Quên mật khẩu</h1>} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const field = (label: string) => screen.getByLabelText(label);

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  options: { current?: string; next?: string; confirm?: string } = {},
) {
  const { current = CURRENT, next = NEW } = options;
  const confirm = options.confirm ?? next;
  await screen.findByRole('heading', { level: 1, name: 'Đổi mật khẩu' });
  if (current) await user.type(field('Mật khẩu hiện tại'), current);
  if (next) await user.type(field('Mật khẩu mới'), next);
  if (confirm) await user.type(field('Nhập lại mật khẩu mới'), confirm);
  await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
});
afterEach(cleanup);

describe('ChangePasswordPage', () => {
  it('submit_showsRequiredErrors_andFocusesFirst_whenEmpty', async () => {
    // Arrange
    const user = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Đổi mật khẩu' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    // Assert
    expect(await screen.findByText('Vui lòng nhập mật khẩu hiện tại.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu mới.')).toBeInTheDocument();
    await waitFor(() => expect(field('Mật khẩu hiện tại')).toHaveFocus());

    // Verify: chưa gọi đổi mật khẩu, vẫn đăng nhập
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBe('dev');
  });

  it('submit_showsPolicyAndMismatchErrors_withoutCalling', async () => {
    // Arrange
    const user = renderPage();

    // Act: mật khẩu mới chưa đạt điều kiện, nhập lại khác
    await fillAndSubmit(user, { next: 'yeu', confirm: 'khac' });

    // Assert
    expect(await screen.findByText('Mật khẩu chưa đạt điều kiện bên dưới.')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeInTheDocument();
    await waitFor(() => expect(field('Mật khẩu mới')).toHaveFocus());
  });

  it('wrongCurrentPassword_showsErrorUnderField_clearsIt_staysSignedIn', async () => {
    // Arrange
    const user = renderPage();

    // Act
    await fillAndSubmit(user, { current: 'sai' });

    // Assert: câu riêng của trang, không phải "Email hoặc mật khẩu không đúng."
    expect(await screen.findByText('Mật khẩu hiện tại không đúng.')).toBeInTheDocument();
    expect(field('Mật khẩu hiện tại')).toHaveValue('');
    await waitFor(() => expect(field('Mật khẩu hiện tại')).toHaveFocus());
    expect(field('Mật khẩu mới')).toHaveValue(NEW);
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBe('dev');
  });

  it('tooManyAttempts_showsAlert', async () => {
    // Arrange
    const user = renderPage();

    // Act
    await fillAndSubmit(user, { current: 'nhieu' });

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
    );
  });

  it('success_signsOutEverywhere_andGoesToLoginWithEmailAndNotice', async () => {
    // Arrange
    const user = renderPage();

    // Act
    await fillAndSubmit(user);

    // Assert: đang gửi giữ chữ "Đang đổi mật khẩu…"
    expect(await screen.findByRole('button', { name: 'Đang đổi mật khẩu…' })).toBeInTheDocument();

    // Assert: tới /login kèm email, from, câu báo; máy này đã đăng xuất
    const state = await screen.findByTestId('login-state', {}, { timeout: 3000 });
    expect(JSON.parse(state.textContent ?? '')).toEqual({
      email: 'khachthu@example.com',
      from: '/account',
      notice: 'Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.',
    });
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });

  it('globalSignOutFails_keepsSession_showsRetry_thenRetryGoesToLogin', async () => {
    // Arrange
    const user = renderPage();

    // Act: mật khẩu mới chứa "loimang": đổi được nhưng đăng xuất mọi nơi lỗi
    await fillAndSubmit(user, { next: 'Moi-loimang-1A!' });

    // Assert: ở lại trang, còn đăng nhập, Alert kèm "Thử lại", form khoá
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toHaveTextContent('Đã đổi mật khẩu nhưng chưa đăng xuất được các thiết bị khác.');
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBe('dev');
    expect(screen.queryByRole('button', { name: 'Đổi mật khẩu' })).toBeNull();
    expect(field('Mật khẩu hiện tại')).toHaveAttribute('readonly');

    // Act: thử lại (chỉ đăng xuất mọi nơi)
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));

    // Assert
    const state = await screen.findByTestId('login-state', {}, { timeout: 3000 });
    expect(JSON.parse(state.textContent ?? '')).toMatchObject({
      email: 'khachthu@example.com',
      notice: 'Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.',
    });
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });

  it('accessTokenRevoked_signsOutThisDevice_andGoesToLoginWithFrom', async () => {
    // Arrange: token vẫn còn trên máy nhưng Cognito báo access token đã bị thu hồi
    vi.mocked(changePassword).mockRejectedValueOnce(
      Object.assign(new Error('Access Token has been revoked'), { name: 'NotAuthorizedException' }),
    );
    const user = renderPage();

    // Act
    await fillAndSubmit(user);

    // Assert: đăng xuất máy này rồi sang /login kèm from (còn token thì /login đẩy về lại trang này)
    const state = await screen.findByTestId('login-state', {}, { timeout: 3000 });
    expect(JSON.parse(state.textContent ?? '')).toEqual({ from: '/account/password' });
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });

  it('signedOutElsewhere_goesToLoginWithFrom', async () => {
    // Arrange: phiên hết trong lúc trang đang mở (token đã mất, không báo đăng nhập đổi); bản mock
    // của changePassword ném UserUnAuthenticatedException khi không còn token
    const user = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Đổi mật khẩu' });
    localStorage.removeItem(DEV_TOKEN_KEY);

    // Act
    await fillAndSubmit(user);

    // Assert
    const state = await screen.findByTestId('login-state', {}, { timeout: 3000 });
    expect(JSON.parse(state.textContent ?? '')).toEqual({ from: '/account/password' });
  });

  it('tab_followsSpecOrder', async () => {
    // Arrange
    const user = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Đổi mật khẩu' });
    field('Mật khẩu hiện tại').focus();

    // Act + Assert: hiện tại → link quên → mới → nhập lại → nút (nút con mắt không nằm trong Tab)
    await user.tab();
    expect(screen.getByRole('link', { name: 'Quên mật khẩu hiện tại?' })).toHaveFocus();
    await user.tab();
    expect(field('Mật khẩu mới')).toHaveFocus();
    await user.tab();
    expect(field('Nhập lại mật khẩu mới')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' })).toHaveFocus();
  });

  it('forgotLink_goesToForgotPassword', async () => {
    // Arrange
    renderPage();

    // Assert
    expect(await screen.findByRole('link', { name: 'Quên mật khẩu hiện tại?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
