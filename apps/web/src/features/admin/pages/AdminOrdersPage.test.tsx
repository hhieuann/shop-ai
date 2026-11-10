// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Account, SessionStatus } from '../../../shared/auth/useSession';
import { AdminOrdersPage } from './AdminOrdersPage';

let session: SessionStatus = 'signedIn';
let account: Account = {
  status: 'signedIn',
  user: { username: 'an', email: 'an@example.com', isAdmin: true },
};
vi.mock('../../../shared/auth/useSession', () => ({
  useSession: () => session,
  useAccount: () => account,
}));

const ORDER = {
  orderId: '01K9B7Q2M4X8T6V3N5P7R9S1W3',
  status: 'CONFIRMED',
  totalAmount: 32_470_000,
  itemCount: 3,
  createdAt: '2026-11-06T06:42:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': status < 400 ? 'application/json' : 'application/problem+json',
    },
  });

/** Trả lời theo method và URL; mặc định danh sách 1 đơn, PATCH thành công */
let listResponse: () => Response;
let patchResponse: () => Response;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async (_url, init) => (init?.method === 'PATCH' ? patchResponse() : listResponse()),
);
const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

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
  session = 'signedIn';
  account = {
    status: 'signedIn',
    user: { username: 'an', email: 'an@example.com', isAdmin: true },
  };
  listResponse = () => json({ items: [ORDER] });
  patchResponse = () => json({ ...ORDER, status: 'SHIPPED' });
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function LoginStub() {
  const { state } = useLocation() as { state: { from?: string } | null };
  return <p>Trang đăng nhập, quay lại {state?.from}</p>;
}

function renderAt(path = '/admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<AdminOrdersPage />} />
          <Route path="/login" element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminOrdersPage · ai thấy gì', () => {
  it('guest_redirectsToLogin_withFrom', async () => {
    // Arrange
    session = 'guest';
    account = { status: 'guest', user: null };

    // Act
    renderAt();

    // Assert
    expect(await screen.findByText('Trang đăng nhập, quay lại /admin')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('customer_seesForbidden_andAdminApiNotCalled', async () => {
    // Arrange
    account = {
      status: 'signedIn',
      user: { username: 'khach', email: 'khach@example.com', isAdmin: false },
    };

    // Act
    renderAt();

    // Assert
    expect(screen.getByText('Bạn không có quyền xem trang này.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
    // Verify
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signedInButProfileUnreadable_seesForbidden_insteadOfLoadingForever', async () => {
    // Arrange: có token nhưng đọc hồ sơ lỗi, useAccount về guest
    account = { status: 'guest', user: null };

    // Act
    renderAt();

    // Assert
    expect(screen.getByText('Bạn không có quyền xem trang này.')).toBeInTheDocument();
    expect(screen.queryByText('Đang tải…')).not.toBeInTheDocument();
    // Verify
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('admin_seesForbidden_whenApiSays403', async () => {
    // Arrange: token có nhóm admin nhưng API từ chối (vd. vừa bị bỏ khỏi nhóm)
    listResponse = () => json({ title: 'Forbidden', status: 403, code: 'FORBIDDEN' }, 403);

    // Act
    renderAt();

    // Assert
    expect(await screen.findByText('Bạn không có quyền xem trang này.')).toBeInTheDocument();
  });
});

describe('AdminOrdersPage · danh sách', () => {
  it('admin_listsConfirmedOrders_withFullIdAndNoAddress', async () => {
    // Act
    renderAt();

    // Assert
    expect(await screen.findByText(ORDER.orderId)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chờ giao' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Đang giao' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('06/11/2026 13:42')).toBeInTheDocument();
    // Vai trò bảng ghi tường minh (điện thoại đổi display của dòng, ô): 1 dòng tiêu đề + 1 đơn
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: 'Mã đơn' })).toBeInTheDocument();
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Chuyển sang Đang giao: đơn ${ORDER.orderId}` }),
    ).toBeInTheDocument();
    // Verify: gọi đúng API, trang không có ô địa chỉ hay SĐT
    expect(String(calls('GET')[0]?.[0])).toBe('/api/v1/admin/orders?status=CONFIRMED&limit=20');
    expect(document.body.textContent).not.toMatch(/Giao tới|Địa chỉ|Số điện thoại/);
  });

  it('shippedTab_readsStatusFromUrl_andOffersDelivered', async () => {
    // Arrange
    listResponse = () => json({ items: [{ ...ORDER, status: 'SHIPPED' }] });

    // Act
    renderAt('/admin?status=SHIPPED');

    // Assert
    expect(
      await screen.findByRole('button', { name: `Đã giao: đơn ${ORDER.orderId}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đang giao' })).toHaveAttribute('aria-current', 'page');
    expect(String(calls('GET')[0]?.[0])).toContain('status=SHIPPED');
  });

  it('emptyTab_showsEmptyState', async () => {
    listResponse = () => json({ items: [] });

    renderAt();

    expect(await screen.findByText('Không có đơn chờ giao.')).toBeInTheDocument();
  });
});

describe('AdminOrdersPage · chuyển trạng thái', () => {
  async function openDialog() {
    const user = userEvent.setup();
    renderAt();
    await user.click(
      await screen.findByRole('button', { name: `Chuyển sang Đang giao: đơn ${ORDER.orderId}` }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Chuyển đơn sang Đang giao?' });
    return { user, dialog };
  }

  it('confirm_patchesNextStatus_closesDialog_andReloadsList', async () => {
    // Arrange
    const { user, dialog } = await openDialog();
    expect(within(dialog).getByText(/khách không tự huỷ đơn này được nữa/)).toBeInTheDocument();

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Chuyển sang Đang giao' }));

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Verify: PATCH đúng đơn, đúng trạng thái kế tiếp; danh sách tải lại
    const [url, init] = calls('PATCH')[0] ?? [];
    expect(url).toBe(`/api/v1/admin/orders/${ORDER.orderId}`);
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'SHIPPED' });
    await waitFor(() => expect(calls('GET')).toHaveLength(2));
    // Dòng vừa bấm rời danh sách: focus về tiêu đề trang, không rơi về body
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Quản trị đơn hàng' })).toHaveFocus(),
    );
  });

  it('cancel_closesDialog_withoutPatching_andReturnsFocusToRowButton', async () => {
    // Arrange
    const { user, dialog } = await openDialog();

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));

    // Assert: focus về đúng nút đã mở hộp, không rơi về body (#425)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: `Chuyển sang Đang giao: đơn ${ORDER.orderId}` }),
      ).toHaveFocus(),
    );
    // Verify
    expect(calls('PATCH')).toHaveLength(0);
  });

  it('esc_closesDialog_andReturnsFocusToRowButton', async () => {
    // Arrange: focus đang ở nút trong hộp như khi dùng bàn phím
    const { dialog } = await openDialog();
    within(dialog).getByRole('button', { name: 'Để sau' }).focus();

    // Act: Esc trên <dialog> gốc phát sự kiện cancel
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: `Chuyển sang Đang giao: đơn ${ORDER.orderId}` }),
      ).toHaveFocus(),
    );
    // Verify
    expect(calls('PATCH')).toHaveLength(0);
  });

  it('conflict409_showsCurrentStatus_andReloadsList', async () => {
    // Arrange: khách vừa huỷ đơn
    patchResponse = () =>
      json(
        {
          title: 'Conflict',
          status: 409,
          code: 'INVALID_STATUS_TRANSITION',
          currentStatus: 'CANCELLED',
        },
        409,
      );
    const { user, dialog } = await openDialog();

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Chuyển sang Đang giao' }));

    // Assert: báo trạng thái thật, hộp thoại vẫn mở, danh sách tải lại
    expect(
      await within(dialog).findByText(/Đơn đã ở trạng thái Đã huỷ\. Danh sách đã được tải lại\./),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls('GET')).toHaveLength(2));
  });

  it('notFound404_asksToRetryLater', async () => {
    patchResponse = () => json({ title: 'Not Found', status: 404 }, 404);
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Chuyển sang Đang giao' }));

    expect(
      await within(dialog).findByText(
        'Không tìm thấy đơn. Nếu đơn vừa đổi trạng thái, thử lại sau ít giây.',
      ),
    ).toBeInTheDocument();
  });
});
