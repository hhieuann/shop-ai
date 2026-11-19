// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  getTwoFactorEnabled,
  setTwoFactorEnabled,
  setUpTwoFactor,
  verifyTwoFactorCode,
} from '../../../shared/auth/token';
import { AccountLayout } from '../components/AccountLayout';
import { TwoFactorPage } from './TwoFactorPage';

// Giữ bản thật của token.ts (token giả để AccountLayout coi là đã đăng nhập); chỉ thay 4 hàm xác thực
// hai lớp để điều khiển kết quả của Cognito
vi.mock('../../../shared/auth/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/auth/token')>();
  return {
    ...actual,
    getTwoFactorEnabled: vi.fn(),
    setUpTwoFactor: vi.fn(),
    verifyTwoFactorCode: vi.fn(),
    setTwoFactorEnabled: vi.fn(),
  };
});

// Thư viện QR cần canvas (jsdom không có): trả ảnh giả, ghi lại URI để kiểm
vi.mock('qrcode', () => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo='),
}));

const DEV_TOKEN_KEY = 'shop-ai:dev-token';
// Mã bí mật sinh lúc chạy (không viết cứng chuỗi trông như khoá): 32 ký tự base32
const generated = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.charAt(b % 32),
).join('');

function Where() {
  const location = useLocation();
  return <pre data-testid="where">{`${location.pathname} ${JSON.stringify(location.state)}`}</pre>;
}

function renderPage(state?: unknown) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[{ pathname: '/account/two-factor', state }]}>
        <Routes>
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<Where />} />
            <Route path="two-factor" element={<TwoFactorPage />} />
          </Route>
          <Route path="/login" element={<Where />} />
          <Route path="/admin" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const named = (name: string) => Object.assign(new Error(name), { name });
const codeField = () => screen.getByLabelText('Mã xác thực');
const submitButton = () => screen.getByRole('button', { name: /Bật xác thực hai lớp|Đang bật/ });

/** Chờ trang tạo mã xong (mã chữ hiện) */
async function ready() {
  await screen.findByText(generated.slice(0, 4), { exact: false });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
  localStorage.setItem('shop-ai:dev-username', 'hoangnm');
  vi.mocked(getTwoFactorEnabled).mockReset().mockResolvedValue(false);
  vi.mocked(setUpTwoFactor).mockReset().mockResolvedValue(generated);
  vi.mocked(verifyTwoFactorCode).mockReset().mockResolvedValue(undefined);
  vi.mocked(setTwoFactorEnabled).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('TwoFactorPage: bật xác thực hai lớp', () => {
  it('render_showsQrSecretGroupedCopyAndAppLink_withBreadcrumb', async () => {
    // Act
    renderPage();
    await ready();

    // Assert: mã chữ chia nhóm 4, QR có alt, link mở ứng dụng là URI otpauth đã mã hoá
    expect(screen.getByText(generated.replace(/(.{4})(?=.)/g, '$1 '))).toBeInTheDocument();
    expect(
      await screen.findByAltText('Mã QR để thêm tài khoản Black Magic vào ứng dụng xác thực'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở bằng ứng dụng trên máy này' })).toHaveAttribute(
      'href',
      `otpauth://totp/Black%20Magic:hoangnm%40example.com?secret=${generated}&issuer=Black%20Magic`,
    );
    expect(screen.getByRole('button', { name: 'Chép mã' })).toBeEnabled();
    expect(screen.getByText(/Không có điện thoại\?/)).toBeInTheDocument();

    // Assert: đường dẫn có tên trang; cột trái giữ "Thông tin tài khoản" (không có mục riêng)
    const crumbs = screen.getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(crumbs).getByText('Xác thực hai lớp')).toHaveAttribute('aria-current', 'page');
    const nav = screen.getByRole('navigation', { name: 'Tài khoản' });
    expect(within(nav).getByRole('link', { name: 'Thông tin tài khoản' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Verify: một lần mở trang một mã
    expect(setUpTwoFactor).toHaveBeenCalledTimes(1);
  });

  it('copy_writesRawSecret_andShowsCopied', async () => {
    // Arrange
    const user = renderPage();
    await ready();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    // Act
    await user.click(screen.getByRole('button', { name: 'Chép mã' }));

    // Assert: chép mã không có dấu cách; nút đổi "Đã chép", vùng aria-live báo
    expect(writeText).toHaveBeenCalledWith(generated);
    expect(await screen.findByRole('button', { name: 'Đã chép' })).toBeInTheDocument();
    expect(screen.getByText('Đã chép mã')).toBeInTheDocument();
  });

  it('shortCode_asksForSixDigits_withoutCallingCognito', async () => {
    // Arrange
    const user = renderPage();
    await ready();

    // Act
    await user.type(codeField(), '123');
    await user.click(submitButton());

    // Assert
    expect(screen.getByText('Nhập đủ 6 số trong ứng dụng.')).toBeInTheDocument();
    // Verify
    expect(verifyTwoFactorCode).not.toHaveBeenCalled();
  });

  it('sixDigits_doNotAutoSubmit', async () => {
    // Arrange
    const user = renderPage();
    await ready();

    // Act: gõ đủ 6 số nhưng không bấm (An chốt 18/11: không tự gửi)
    await user.type(codeField(), '123456');

    // Verify
    expect(verifyTwoFactorCode).not.toHaveBeenCalled();
  });

  it('wrongCode_showsErrorUnderField_clearsDigits_andStaysDisabled', async () => {
    // Arrange
    vi.mocked(verifyTwoFactorCode).mockRejectedValueOnce(named('CodeMismatchException'));
    const user = renderPage();
    await ready();

    // Act
    await user.type(codeField(), '000000{Enter}');

    // Assert
    expect(
      await screen.findByText(
        'Mã không đúng. Nhập mã đang hiện trong ứng dụng (mã đổi mỗi 30 giây).',
      ),
    ).toBeInTheDocument();
    expect(codeField()).toHaveValue('');
    expect(codeField()).toHaveFocus();
    // Verify: chưa bật
    expect(setTwoFactorEnabled).not.toHaveBeenCalled();
  });

  it('rightCode_enables_andReturnsToAccountWithNotice', async () => {
    // Arrange
    const user = renderPage();
    await ready();

    // Act
    await user.type(codeField(), '123456');
    await user.click(submitButton());

    // Assert: về /account kèm câu báo
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/account {"notice":"Đã bật xác thực hai lớp. Lần đăng nhập sau cần mã 6 số."}',
    );
    // Verify: xác nhận mã rồi bật
    expect(verifyTwoFactorCode).toHaveBeenCalledWith('123456');
    expect(setTwoFactorEnabled).toHaveBeenCalledWith(true);
  });

  it('enableFailsAfterVerify_retryOnlyEnables', async () => {
    // Arrange: mã đúng nhưng bước bật lỗi mạng
    vi.mocked(setTwoFactorEnabled).mockRejectedValueOnce(named('NetworkError'));
    const user = renderPage();
    await ready();
    await user.type(codeField(), '123456');

    // Act
    await user.click(submitButton());

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không kết nối được máy chủ, vui lòng thử lại.',
    );

    // Act: bấm lại
    await user.click(submitButton());

    // Assert + Verify: không xác nhận lại mã cũ (mã đã dùng), chỉ bật
    expect(await screen.findByTestId('where')).toHaveTextContent('/account');
    expect(verifyTwoFactorCode).toHaveBeenCalledTimes(1);
    expect(setTwoFactorEnabled).toHaveBeenCalledTimes(2);
  });

  it('fromAdmin_showsAdminNotice_andReturnsToAdminAfterEnable', async () => {
    // Arrange: trang admin chuyển sang (admin-don-hang.md mục 1)
    const user = renderPage({ from: '/admin', reason: 'admin' });
    await ready();

    // Assert
    expect(screen.getByText('Tài khoản quản trị cần bật xác thực hai lớp.')).toBeInTheDocument();

    // Act
    await user.type(codeField(), '123456');
    await user.click(submitButton());

    // Assert
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin null');
  });

  it('alreadyEnabled_redirectsToAccount_withoutCreatingSecret', async () => {
    // Arrange
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);

    // Act
    renderPage();

    // Assert
    expect(await screen.findByTestId('where')).toHaveTextContent('/account null');
    // Verify: không tạo mã mới khi đã bật
    expect(setUpTwoFactor).not.toHaveBeenCalled();
  });

  it('statusReadFails_doesNotCreateSecret_andRetryThenCreatesOnce', async () => {
    // Arrange: đọc trạng thái lỗi. Không được tạo mã: AssociateSoftwareToken gỡ ngay mã đang dùng nếu
    // tài khoản thật ra đã bật
    vi.mocked(getTwoFactorEnabled)
      .mockRejectedValueOnce(named('NetworkError'))
      .mockResolvedValueOnce(false);
    const user = renderPage();
    const alert = await screen.findByRole('alert');

    // Assert: báo lỗi trạng thái, mã chưa tạo, nút bật vô hiệu
    expect(alert).toHaveTextContent(
      'Không tải được trạng thái xác thực hai lớp, vui lòng thử lại.',
    );
    expect(submitButton()).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Mở bằng ứng dụng trên máy này' })).toBeNull();
    // Verify
    expect(setUpTwoFactor).not.toHaveBeenCalled();

    // Act: thử lại, lần này đọc được "đang tắt"
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));

    // Assert + Verify: tạo mã đúng một lần, câu lỗi tắt
    await ready();
    expect(
      screen.queryByText('Không tải được trạng thái xác thực hai lớp, vui lòng thử lại.'),
    ).toBeNull();
    expect(submitButton()).toBeEnabled();
    expect(setUpTwoFactor).toHaveBeenCalledTimes(1);
  });

  it('setupFails_showsRetry_andRetryCreatesSecret', async () => {
    // Arrange
    vi.mocked(setUpTwoFactor).mockRejectedValueOnce(named('NetworkError'));
    const user = renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không tạo được mã, vui lòng thử lại.');
    expect(submitButton()).toBeDisabled();

    // Act
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));

    // Assert
    await ready();
    expect(screen.queryByText('Không tạo được mã, vui lòng thử lại.')).toBeNull();
    expect(submitButton()).toBeEnabled();
  });

  it('sessionExpired_signsOutAndGoesToLogin', async () => {
    // Arrange
    vi.mocked(verifyTwoFactorCode).mockRejectedValueOnce(named('NotAuthorizedException'));
    const user = renderPage();
    await ready();

    // Act
    await user.type(codeField(), '123456');
    await user.click(submitButton());

    // Assert: đăng xuất máy này rồi sang /login, xong quay lại trang bật
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/login {"from":"/account/two-factor"}',
    );
    await waitFor(() => expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull());
  });
});
