// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { refreshProfile } from '../../../shared/auth/token';
import { AccountLayout } from '../components/AccountLayout';
import { AccountInfoPage } from './AccountInfoPage';

// Token giả (shared/auth/token.ts bản mock): username đọc từ localStorage 'shop-ai:dev-username'
const DEV_TOKEN_KEY = 'shop-ai:dev-token';
const USERNAME_KEY = 'shop-ai:dev-username';

// Giữ bản thật của token.ts; chỉ bọc refreshProfile để một ca giả được lỗi làm mới phiên
vi.mock('../../../shared/auth/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/auth/token')>();
  return { ...actual, refreshProfile: vi.fn(actual.refreshProfile) };
});

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const problem = (status: number, code?: string) =>
  json(status, { title: 'Lỗi', status, ...(code ? { code } : {}) }, 'application/problem+json');

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const patchCalls = () =>
  fetchMock.mock.calls.filter(([url, init]) => url === '/api/v1/me' && init?.method === 'PATCH');

function Where() {
  const location = useLocation();
  return <pre data-testid="where">{`${location.pathname} ${JSON.stringify(location.state)}`}</pre>;
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<AccountInfoPage />} />
          </Route>
          <Route path="/login" element={<Where />} />
          <Route path="/" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const usernameField = () => screen.getByLabelText('Username');
const updateButton = () => screen.getByRole('button', { name: /Cập nhật|Đang cập nhật/ });

async function ready() {
  await waitFor(() => expect(usernameField()).toHaveValue('hoangnm'));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
  localStorage.setItem(USERNAME_KEY, 'hoangnm');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AccountInfoPage: đổi username', () => {
  it('button_disabledWhenUnchanged_enabledWhenChanged_disabledAgainWhenSame', async () => {
    // Arrange
    const user = renderPage();
    await ready();

    // Assert: chưa sửa thì vô hiệu
    expect(updateButton()).toBeDisabled();

    // Act + Assert: gõ thêm một ký tự thì bấm được, gõ lại như cũ thì vô hiệu
    await user.type(usernameField(), 'x');
    expect(updateButton()).toBeEnabled();
    await user.type(usernameField(), '{Backspace}');
    expect(updateButton()).toBeDisabled();
  });

  it('emptyField_showsRequiredErrorAtOnce_andDisablesButton', async () => {
    // Arrange
    const user = renderPage();
    await ready();

    // Act
    await user.clear(usernameField());

    // Assert: lỗi hiện ngay, ô aria-invalid, nối lỗi trước rồi gợi ý (tai-khoan.md mục 6)
    expect(screen.getByText('Vui lòng nhập username.')).toBeInTheDocument();
    expect(usernameField()).toHaveAttribute('aria-invalid', 'true');
    expect(updateButton()).toBeDisabled();
    const [errorId, hintId] = (usernameField().getAttribute('aria-describedby') ?? '').split(' ');
    expect(document.getElementById(errorId!)).toHaveTextContent('Vui lòng nhập username.');
    expect(document.getElementById(hintId!)).toHaveTextContent('3–20 ký tự');
  });

  it('invalidName_showsRuleError_withoutCallingApi', async () => {
    // Arrange
    const user = renderPage();
    await ready();

    // Act
    await user.clear(usernameField());
    await user.type(usernameField(), 'An Nguyen');
    await user.click(updateButton());

    // Assert
    expect(await screen.findByText('Username chưa đúng quy tắc bên dưới.')).toBeInTheDocument();
    await waitFor(() => expect(usernameField()).toHaveFocus());

    // Verify
    expect(patchCalls()).toHaveLength(0);
  });

  it('taken_showsErrorUnderField_andKeepsName', async () => {
    // Arrange
    fetchMock.mockResolvedValue(problem(409, 'USERNAME_TAKEN'));
    const user = renderPage();
    await ready();

    // Act: Enter trong ô cũng gửi
    await user.clear(usernameField());
    await user.type(usernameField(), 'an_nguyen{Enter}');

    // Assert
    expect(await screen.findByText('Username này đã có người dùng.')).toBeInTheDocument();
    expect(localStorage.getItem(USERNAME_KEY)).toBe('hoangnm');

    // Verify: gửi đúng body
    expect(patchCalls()).toHaveLength(1);
    expect(JSON.parse(String(patchCalls()[0]![1]!.body))).toEqual({ username: 'an_nguyen' });

    // Act + Assert: gõ tiếp thì lỗi tắt
    await user.type(usernameField(), 'x');
    expect(screen.queryByText('Username này đã có người dùng.')).toBeNull();
  });

  it('success_showsAlert_refreshesProfile_andNavGetsNewName', async () => {
    // Arrange
    fetchMock.mockResolvedValue(json(200, { username: 'hoang.nm' }));
    const user = renderPage();
    await ready();

    // Act
    await user.clear(usernameField());
    await user.type(usernameField(), 'hoang.nm');
    await user.click(updateButton());

    // Assert: Alert thành công, nút về vô hiệu, hồ sơ làm mới (cột trái hiện tên mới), focus ở ô
    expect(await screen.findByRole('status')).toHaveTextContent('Đã cập nhật username.');
    expect(updateButton()).toBeDisabled();
    expect(usernameField()).toHaveValue('hoang.nm');
    await waitFor(() =>
      expect(screen.getByText('hoang.nm', { selector: 'p' })).toBeInTheDocument(),
    );
    await waitFor(() => expect(usernameField()).toHaveFocus());

    // Verify: bản mock của refreshProfile ghi tên mới
    expect(localStorage.getItem(USERNAME_KEY)).toBe('hoang.nm');

    // Act + Assert: sửa ô lần nữa thì Alert tắt
    await user.type(usernameField(), 'x');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('refreshProfileFails_stillShowsSuccess_withoutErrorAlert', async () => {
    // Arrange: PATCH thành công nhưng làm mới phiên lỗi (mạng)
    fetchMock.mockResolvedValue(json(200, { username: 'hoang.nm' }));
    vi.mocked(refreshProfile).mockRejectedValueOnce(new TypeError('offline'));
    const user = renderPage();
    await ready();

    // Act
    await user.clear(usernameField());
    await user.type(usernameField(), 'hoang.nm');
    await user.click(updateButton());

    // Assert: username đã đổi nên vẫn báo thành công, không báo lỗi kết nối
    expect(await screen.findByRole('status')).toHaveTextContent('Đã cập nhật username.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(updateButton()).toBeDisabled();
    expect(usernameField()).toHaveValue('hoang.nm');

    // Verify
    expect(refreshProfile).toHaveBeenCalledWith({ username: 'hoang.nm' });
  });

  it('serverOrNetworkError_showsAlert', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(problem(500)).mockRejectedValueOnce(new TypeError('offline'));
    const user = renderPage();
    await ready();
    await user.type(usernameField(), 'x');

    // Act + Assert: 5xx
    await user.click(updateButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không kết nối được máy chủ, vui lòng thử lại.',
    );

    // Act + Assert: mất mạng
    await user.click(updateButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không kết nối được máy chủ, vui lòng thử lại.',
    );
  });

  it('badRequestWithoutCode_showsAlert', async () => {
    // Arrange
    fetchMock.mockResolvedValue(problem(400));
    const user = renderPage();
    await ready();
    await user.type(usernameField(), 'x');

    // Act
    await user.click(updateButton());

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không cập nhật được username, vui lòng thử lại.',
    );
  });

  it('unauthorized_signsOutThisDevice_andGoesToLoginWithFrom', async () => {
    // Arrange: token còn trên máy nhưng API trả 401
    fetchMock.mockResolvedValue(problem(401));
    const user = renderPage();
    await ready();
    await user.type(usernameField(), 'x');

    // Act
    await user.click(updateButton());

    // Assert: đăng xuất máy này rồi sang /login, đăng nhập xong quay lại trang tài khoản
    expect(await screen.findByTestId('where')).toHaveTextContent('/login {"from":"/account"}');
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });
});
