// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AccountInfoPage } from '../pages/AccountInfoPage';
import { AccountLayout } from './AccountLayout';

const DEV_TOKEN_KEY = 'shop-ai:dev-token';

function Probe({ name }: { name: string }) {
  const location = useLocation();
  return (
    <p data-testid="probe">
      {name} {JSON.stringify(location.state)}
    </p>
  );
}

function renderAt(path: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<AccountInfoPage />} />
            <Route path="password" element={<h1>Đổi mật khẩu</h1>} />
          </Route>
          <Route path="/login" element={<Probe name="login" />} />
          <Route path="/" element={<Probe name="home" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

/** Đăng nhập bằng token giả, username "hoangnm" (token.ts bản mock) */
function signIn() {
  localStorage.setItem(DEV_TOKEN_KEY, 'dev');
  localStorage.setItem('shop-ai:dev-username', 'hoangnm');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe('AccountLayout', () => {
  it('redirectsToLoginWithFrom_whenGuest', async () => {
    // Act
    renderAt('/account/password');

    // Assert: đăng nhập xong quay lại đúng mục (pages/tai-khoan.md mục 1)
    expect(await screen.findByTestId('probe')).toHaveTextContent(
      'login {"from":"/account/password"}',
    );
  });

  it('showsNavWithCurrentSection_andAccountInfo_whenSignedIn', async () => {
    // Arrange
    signIn();

    // Act
    renderAt('/account');

    // Assert: cột trái có đầu khối và mục đang xem
    const nav = await screen.findByRole('navigation', { name: 'Tài khoản' });
    expect(within(nav).getByRole('link', { name: 'Thông tin tài khoản' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Đổi mật khẩu' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(within(nav).getByRole('link', { name: 'Đơn hàng của tôi' })).toHaveAttribute(
      'href',
      '/orders',
    );
    expect(screen.getAllByText('hoangnm@example.com').length).toBeGreaterThan(0);

    // Assert: nội dung là <section> trỏ vào <h1>, hai ô chỉ xem
    expect(screen.getByRole('region', { name: 'Thông tin tài khoản' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('hoangnm');
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Email')).toHaveValue('hoangnm@example.com');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    const panel = screen.getByRole('region', { name: 'Thông tin tài khoản' });
    expect(within(panel).getByRole('link', { name: 'Đổi mật khẩu' })).toHaveAttribute(
      'href',
      '/account/password',
    );
    expect(screen.queryByRole('button', { name: 'Cập nhật' })).toBeNull();
  });

  it('breadcrumb_followsSection', async () => {
    // Arrange
    signIn();

    // Act
    renderAt('/account/password');

    // Assert: "Trang chủ › Tài khoản › Đổi mật khẩu", "Tài khoản" là link
    const crumbs = await screen.findByRole('navigation', { name: 'Đường dẫn' });
    expect(within(crumbs).getByRole('link', { name: 'Tài khoản' })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(within(crumbs).getByText('Đổi mật khẩu')).toHaveAttribute('aria-current', 'page');
  });

  it('signOutInNav_goesHome', async () => {
    // Arrange
    signIn();
    const user = renderAt('/account');
    const nav = await screen.findByRole('navigation', { name: 'Tài khoản' });

    // Act
    await user.click(within(nav).getByRole('button', { name: 'Đăng xuất' }));

    // Assert: về trang chủ, không sang /login
    expect(await screen.findByTestId('probe')).toHaveTextContent('home');
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull();
  });
});

describe('AccountSectionSheet (<1280)', () => {
  it('opensFromSwitcher_focusesCurrent_escClosesAndReturnsFocus', async () => {
    // Arrange
    signIn();
    const user = renderAt('/account');
    const switcher = await screen.findByRole('button', { name: /Thông tin tài khoản.*Đổi mục/ });

    // Act: mở bảng
    await user.click(switcher);

    // Assert: hộp thoại modal, focus ở mục đang xem
    const sheet = screen.getByRole('dialog', { name: 'Tài khoản' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(within(sheet).getByRole('link', { name: 'Thông tin tài khoản' })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('hidden');

    // Act: Esc
    await user.keyboard('{Escape}');

    // Assert: đóng, trả focus, mở khoá cuộn
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(switcher).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('keepsFocusInside_whenTabbingPastLast', async () => {
    // Arrange
    signIn();
    const user = renderAt('/account');
    await user.click(await screen.findByRole('button', { name: /Đổi mục/ }));
    const sheet = screen.getByRole('dialog', { name: 'Tài khoản' });
    within(sheet).getByRole('button', { name: 'Đăng xuất' }).focus();

    // Act
    await user.tab();

    // Assert: Tab ở phần tử cuối quay về phần tử đầu (nút Đóng)
    expect(within(sheet).getByRole('button', { name: 'Đóng' })).toHaveFocus();
  });

  it('choosingSection_closesAndNavigates', async () => {
    // Arrange
    signIn();
    const user = renderAt('/account');
    await user.click(await screen.findByRole('button', { name: /Đổi mục/ }));
    const sheet = screen.getByRole('dialog', { name: 'Tài khoản' });

    // Act
    await user.click(within(sheet).getByRole('link', { name: 'Đổi mật khẩu' }));

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { level: 1, name: 'Đổi mật khẩu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đổi mật khẩu.*Đổi mục/ })).toBeInTheDocument();
  });

  it('closeButtonAndScrim_close', async () => {
    // Arrange
    signIn();
    const user = renderAt('/account');
    const switcher = await screen.findByRole('button', { name: /Đổi mục/ });

    // Act + Assert: nút Đóng
    await user.click(switcher);
    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(switcher).toHaveFocus();

    // Act + Assert: vùng tối (phần tử ngay trước hộp thoại)
    await user.click(switcher);
    const scrim = screen.getByRole('dialog').previousElementSibling as HTMLElement;
    await user.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
