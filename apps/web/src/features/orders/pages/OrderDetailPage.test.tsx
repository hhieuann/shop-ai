// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SessionStatus } from '../../../shared/auth/useSession';
import type { Order, OrderStatus } from '../types';
import { OrderDetailPage } from './OrderDetailPage';

let session: SessionStatus = 'signedIn';
vi.mock('../../../shared/auth/useSession', () => ({ useSession: () => session }));

const ORDER_ID = '01M4QD8T2H7V9C3X5B1N6R8DWQ';

const ITEMS: Order['items'] = [
  { productId: 'p-laptop', name: 'Laptop ASUS TUF Gaming A15', price: 24_990_000, quantity: 1 },
  { productId: 'p-mouse', name: 'Chuột Logitech G502', price: 3_290_000, quantity: 1 },
  { productId: 'p-bag', name: 'Balo laptop', price: 1_040_000, quantity: 2 },
];

function makeOrder(status: OrderStatus, items: Order['items'] = ITEMS): Order {
  return {
    orderId: ORDER_ID,
    userId: 'user-1',
    status,
    items,
    totalAmount: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    shippingFee: 0,
    shippingAddress: {
      fullName: 'Nguyễn Minh Hoàng',
      phone: '0912345678',
      address: '12 Nguyễn Huệ',
      province: 'TP. Hồ Chí Minh',
    },
    paymentMethod: 'COD',
    createdAt: '2026-11-09T03:24:00Z',
    updatedAt: '2026-11-09T03:24:00Z',
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status < 400 ? 'application/json' : 'application/problem+json' },
  });

/** Phản hồi của GET và DELETE; test đổi trước khi render */
let getResponse: () => Response;
let deleteResponse: () => Response;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async (_url, init) => (init?.method === 'DELETE' ? deleteResponse() : getResponse()),
);
const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

beforeAll(() => {
  // jsdom chưa có showModal, close của <dialog>: giả lập focus nút đầu như trình duyệt
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
    this.querySelector('button')?.focus();
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

beforeEach(() => {
  session = 'signedIn';
  getResponse = () => json(makeOrder('PENDING'));
  deleteResponse = () => json(makeOrder('CANCELLED'));
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** In state hiện tại của history để kiểm cờ justCreated đã bị xoá */
function StateProbe() {
  const { state } = useLocation();
  return <output data-testid="state">{JSON.stringify(state)}</output>;
}

function renderPage(state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: `/orders/${ORDER_ID}`, state }]}>
        <Routes>
          <Route
            path="/orders/:orderId"
            element={
              <>
                <OrderDetailPage />
                <StateProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cancelButton = () => screen.queryByRole('button', { name: 'Huỷ đơn' });

/** Mở trang đơn PENDING rồi bấm "Huỷ đơn" (nút có focus như khi bấm trên Chrome, Edge hoặc bàn phím) */
async function openDialog() {
  renderPage();
  const button = await screen.findByRole('button', { name: 'Huỷ đơn' });
  button.focus();
  fireEvent.click(button);
  return screen.getByRole('dialog');
}

describe('Chi tiết đơn /orders/:orderId (pages/don-hang.md mục 4)', () => {
  it('detail_namesOrderByFirstItem_whenManyItems', async () => {
    // Act
    renderPage();

    // Assert
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Laptop ASUS TUF Gaming A15 và 2 sản phẩm khác',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tạm tính (3 sản phẩm)')).toBeInTheDocument();
    expect(screen.getByText('Miễn phí')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chuột Logitech G502' })).toHaveAttribute(
      'href',
      '/products/p-mouse',
    );
  });

  it('detail_namesOrderByItem_whenOneItem', async () => {
    getResponse = () => json(makeOrder('PENDING', ITEMS.slice(0, 1)));

    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Laptop ASUS TUF Gaming A15' }),
    ).toBeInTheDocument();
  });

  it.each(['PENDING', 'CONFIRMED'] as const)('detail_showsCancelButton_when %s', async (status) => {
    getResponse = () => json(makeOrder(status));

    renderPage();

    expect(await screen.findByRole('button', { name: 'Huỷ đơn' })).toBeInTheDocument();
  });

  it.each(['SHIPPED', 'DELIVERED', 'CANCELLED'] as const)(
    'detail_hidesCancelButton_when %s',
    async (status) => {
      getResponse = () => json(makeOrder(status));

      renderPage();

      await screen.findByRole('heading', { level: 1 });
      expect(cancelButton()).toBeNull();
    },
  );

  it('detail_showsCancelledState_insteadOfSteps', async () => {
    getResponse = () => json(makeOrder('CANCELLED'));

    renderPage();

    expect(await screen.findByText('Đơn đã huỷ')).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('cancel_opensDialog_focusingKeepOrder', async () => {
    // Act
    const dialog = await openDialog();

    // Assert
    expect(within(dialog).getByRole('heading', { name: 'Huỷ đơn này?' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      'Đơn “Laptop ASUS TUF Gaming A15 và 2 sản phẩm khác” sẽ bị huỷ và không khôi phục được.',
    );
    expect(within(dialog).getByRole('button', { name: 'Giữ đơn' })).toHaveFocus();
    // Verify: mở hộp không huỷ ngay
    expect(calls('DELETE')).toHaveLength(0);
  });

  it('cancel_keepOrder_closesDialog_withoutDelete', async () => {
    // Arrange
    const dialog = await openDialog();

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Giữ đơn' }));

    // Assert: hộp đóng, nút "Huỷ đơn" vẫn còn
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cancelButton()).toBeInTheDocument();
    await waitFor(() => expect(cancelButton()).toHaveFocus());
    // Verify
    expect(calls('DELETE')).toHaveLength(0);
  });

  it('cancel_esc_closesDialog_andReturnsFocusToCancelButton', async () => {
    // Arrange: focus đang ở nút trong hộp
    const dialog = await openDialog();
    within(dialog).getByRole('button', { name: 'Giữ đơn' }).focus();

    // Act: Esc trên <dialog> gốc phát sự kiện cancel
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    // Assert: ConfirmDialog tự trả focus, trang không phải vá (#425)
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(cancelButton()).toHaveFocus());
    // Verify
    expect(calls('DELETE')).toHaveLength(0);
  });

  it('cancel_confirm_cancelsOrder_andShowsCancelledState', async () => {
    // Arrange
    const dialog = await openDialog();

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ đơn' }));

    // Assert
    expect(await screen.findByText('Đã huỷ đơn.')).toBeInTheDocument();
    expect(screen.getByText('Đơn đã huỷ')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cancelButton()).toBeNull();
    // Verify
    expect(calls('DELETE')).toHaveLength(1);
    expect(calls('DELETE')[0]![0]).toContain(`/orders/${ORDER_ID}`);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
  });

  it('cancel_conflict_closesDialog_andShowsCannotCancel', async () => {
    // Arrange: admin vừa chuyển đơn sang Đang giao
    deleteResponse = () => json({ title: 'Conflict', code: 'CANNOT_CANCEL' }, 409);
    const dialog = await openDialog();
    getResponse = () => json(makeOrder('SHIPPED'));

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ đơn' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Đơn đã được giao cho đơn vị vận chuyển, không huỷ được nữa.',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    // Verify: tải lại đơn, trạng thái mới không còn nút huỷ
    await waitFor(() => expect(cancelButton()).toBeNull());
    expect(calls('GET').length).toBeGreaterThanOrEqual(2);
  });

  it('cancel_otherError_keepsDialogOpen_withError', async () => {
    // Arrange
    deleteResponse = () => json({ title: 'Lỗi' }, 500);
    const dialog = await openDialog();

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ đơn' }));

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Không huỷ được đơn, vui lòng thử lại.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('justCreated_showsSuccess_andClearsHistoryState', async () => {
    // Act
    renderPage({ justCreated: true });

    // Assert
    // (khung chờ lúc tải cũng là role status, nên tìm theo chữ rồi lấy khung thông báo)
    const status = (await screen.findByText('Đặt hàng thành công!')).closest('[role="status"]');
    expect(status).toHaveTextContent('Đặt hàng thành công!');
    expect(status).toHaveTextContent('Bạn thanh toán khi nhận hàng.');
    await waitFor(() => expect(status).toHaveFocus());
    // Verify: cờ đã bị xoá khỏi history, tải lại trang không hiện lại
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('notFound_showsEmptyState_withLinkToOrders', async () => {
    getResponse = () => json({ title: 'Not Found' }, 404);

    renderPage();

    expect(await screen.findByText('Không tìm thấy đơn hàng này.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem đơn hàng của tôi' })).toHaveAttribute(
      'href',
      '/orders',
    );
  });

  it('loadError_showsAlert', async () => {
    getResponse = () => json({ title: 'Lỗi' }, 500);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được đơn hàng. Tải lại trang để thử lần nữa.',
    );
  });
});
