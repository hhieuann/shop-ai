// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getTwoFactorEnabled } from '../shared/auth/token';
import type { Account, SessionStatus } from '../shared/auth/useSession';
import { AdminLayout } from './AdminLayout';

let session: SessionStatus = 'signedIn';
let account: Account;
// Menu tài khoản thật có test riêng (AccountMenu.test.tsx), cần ResizeObserver, matchMedia
vi.mock('./AccountMenu', () => ({
  AccountMenu: () => <button type="button">{'Tài khoản của an'}</button>,
}));
vi.mock('../shared/auth/useSession', () => ({
  useSession: () => session,
  useAccount: () => account,
}));
vi.mock('../shared/auth/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/auth/token')>();
  return { ...actual, getTwoFactorEnabled: vi.fn() };
});

const ADMIN: Account = {
  status: 'signedIn',
  user: { userId: 'sub-an', username: 'an', email: 'an@example.com', isAdmin: true },
};

beforeEach(() => {
  session = 'signedIn';
  account = ADMIN;
  vi.mocked(getTwoFactorEnabled).mockReset().mockResolvedValue(true);
});

afterEach(cleanup);

function TwoFactorStub() {
  const { state } = useLocation();
  return <p>Trang bật xác thực hai lớp {JSON.stringify(state)}</p>;
}

function renderAt(path = '/admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<h1>Trang đơn hàng</h1>} />
          </Route>
          <Route path="/account/two-factor" element={<TwoFactorStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminLayout · khung (design-system §9.29)', () => {
  it('admin_seesTopBarAndNav_withOrdersCurrent', async () => {
    // Act
    renderAt();

    // Assert: trang con hiện trong vùng nội dung chính
    expect(await screen.findByRole('heading', { name: 'Trang đơn hàng' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    // Thanh trên: logo về trang quản trị, link về cửa hàng, menu tài khoản
    expect(screen.getByRole('link', { name: 'Black Magic, trang quản trị' })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(screen.getByRole('link', { name: 'Về cửa hàng' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Tài khoản của an' })).toBeInTheDocument();
    // Điều hướng: Đơn hàng là mục hiện tại; Sản phẩm chưa có trang nên chưa hiện
    const nav = screen.getByRole('navigation', { name: 'Quản trị' });
    expect(within(nav).getByRole('link', { name: 'Đơn hàng' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).queryByRole('link', { name: 'Sản phẩm' })).toBeNull();
    // Không có ô tìm kiếm, hàng danh mục của cửa hàng
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('ordersItem_staysCurrent_whenTabIsInQuery', async () => {
    // Act
    renderAt('/admin?status=SHIPPED');

    // Assert
    const nav = await screen.findByRole('navigation', { name: 'Quản trị' });
    expect(within(nav).getByRole('link', { name: 'Đơn hàng' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('customer_seesForbidden_withoutNavOrPage', () => {
    // Arrange
    account = {
      status: 'signedIn',
      user: { userId: 'sub-khach', username: 'khach', email: 'khach@example.com', isAdmin: false },
    };

    // Act
    renderAt();

    // Assert
    expect(screen.getByText('Bạn không có quyền xem trang này.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Quản trị' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Trang đơn hàng' })).toBeNull();
    // Verify: khách thường không cần đọc trạng thái xác thực hai lớp
    expect(getTwoFactorEnabled).not.toHaveBeenCalled();
  });

  it('adminWithoutMfa_redirectsToTwoFactor_keepingFullPath', async () => {
    // Arrange
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(false);

    // Act
    renderAt('/admin?status=SHIPPED');

    // Assert: bật xong quay lại đúng tab đang mở
    expect(
      await screen.findByText(
        'Trang bật xác thực hai lớp {"from":"/admin?status=SHIPPED","reason":"admin"}',
      ),
    ).toBeInTheDocument();
  });
});
