// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getTwoFactorEnabled, setTwoFactorEnabled } from '../../../shared/auth/token';
import { AccountInfoPage } from '../pages/AccountInfoPage';
import { AccountLayout } from './AccountLayout';

// Giữ bản thật của token.ts (token giả); chỉ thay hàm đọc trạng thái và bật, tắt
vi.mock('../../../shared/auth/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/auth/token')>();
  return { ...actual, getTwoFactorEnabled: vi.fn(), setTwoFactorEnabled: vi.fn() };
});

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

function Where() {
  const location = useLocation();
  return <pre data-testid="where">{`${location.pathname} ${JSON.stringify(location.state)}`}</pre>;
}

/** Ghi lại state của history ở /account (câu báo phải được xoá sau khi đọc) */
let lastState: unknown;
function StateSpy() {
  lastState = useLocation().state;
  return null;
}

function renderPage(state?: unknown) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[{ pathname: '/account', state }]}>
        <StateSpy />
        <Routes>
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<AccountInfoPage />} />
            <Route path="two-factor" element={<Where />} />
          </Route>
          <Route path="/login" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const named = (name: string) => Object.assign(new Error(name), { name });
const section = () =>
  screen.getByRole('heading', { level: 2, name: 'Xác thực hai lớp' }).parentElement!.parentElement!
    .parentElement!;

beforeAll(() => {
  // jsdom chưa có showModal, close của <dialog>
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
  localStorage.setItem('shop-ai:dev-username', 'hoangnm');
  vi.mocked(getTwoFactorEnabled).mockReset().mockResolvedValue(false);
  vi.mocked(setTwoFactorEnabled).mockReset().mockResolvedValue(undefined);
  lastState = undefined;
});
afterEach(cleanup);

describe('TwoFactorSection (/account)', () => {
  it('disabled_showsBadgeTextAndEnableLink', async () => {
    // Act
    renderPage();

    // Assert
    const link = await screen.findByRole('link', { name: 'Bật' });
    expect(link).toHaveAttribute('href', '/account/two-factor');
    expect(within(section()).getByText('Đang tắt')).toBeInTheDocument();
    expect(
      screen.getByText('Nhập thêm mã 6 số từ ứng dụng xác thực mỗi lần đăng nhập.'),
    ).toBeInTheDocument();
  });

  it('loading_showsCheckingText_withoutBadgeOrButton', async () => {
    // Arrange: trạng thái chưa trả về
    vi.mocked(getTwoFactorEnabled).mockReturnValue(new Promise(() => {}));

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Đang kiểm tra…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bật' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tắt' })).toBeNull();
  });

  it('readError_showsReloadText_withoutButton', async () => {
    // Arrange
    vi.mocked(getTwoFactorEnabled).mockRejectedValue(named('NetworkError'));

    // Act
    renderPage();

    // Assert
    expect(
      await screen.findByText('Không tải được trạng thái, vui lòng tải lại trang.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bật' })).toBeNull();
  });

  it('enabled_confirmDisable_turnsOff_showsNotice_andFocusesEnable', async () => {
    // Arrange
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);
    const user = renderPage();
    expect(await screen.findByText('Đang bật')).toBeInTheDocument();

    // Act: bấm "Tắt" → hộp thoại, "Giữ bật" focus trước
    await user.click(screen.getByRole('button', { name: 'Tắt' }));
    const dialog = screen.getByRole('dialog', { name: 'Tắt xác thực hai lớp?' });
    expect(within(dialog).getByRole('button', { name: 'Giữ bật' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tắt' }));

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent('Đã tắt xác thực hai lớp.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(section()).getByText('Đang tắt')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Bật' })).toHaveFocus());

    // Verify
    expect(setTwoFactorEnabled).toHaveBeenCalledWith(false);
  });

  it('keepEnabled_closesDialog_withoutCallingCognito', async () => {
    // Arrange
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tắt' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Giữ bật' }));

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Đang bật')).toBeInTheDocument();
    // Verify
    expect(setTwoFactorEnabled).not.toHaveBeenCalled();
  });

  it('disableFails_closesDialog_andShowsAlert', async () => {
    // Arrange
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);
    vi.mocked(setTwoFactorEnabled).mockRejectedValueOnce(named('LimitExceededException'));
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tắt' }));

    // Act
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tắt' }));

    // Assert: vẫn bật, báo lỗi ở đầu trang
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Đang bật')).toBeInTheDocument();
  });

  it('disableSessionExpired_signsOutAndGoesToLogin', async () => {
    // Arrange
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);
    vi.mocked(setTwoFactorEnabled).mockRejectedValueOnce(named('NotAuthorizedException'));
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tắt' }));

    // Act
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tắt' }));

    // Assert
    expect(await screen.findByTestId('where')).toHaveTextContent('/login {"from":"/account"}');
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });

  it('incomingNotice_showsSuccess_focused_andIsClearedFromHistory', async () => {
    // Act: vừa bật xong ở /account/two-factor
    renderPage({ notice: 'Đã bật xác thực hai lớp. Lần đăng nhập sau cần mã 6 số.' });

    // Assert
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Đã bật xác thực hai lớp. Lần đăng nhập sau cần mã 6 số.');
    await waitFor(() => expect(status).toHaveFocus());
    await waitFor(() => expect(lastState).toBeNull());
  });
});
