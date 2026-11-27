// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SessionStatus } from '../../../shared/auth/useSession';
import alertStyles from '../../../shared/components/Alert.module.css';
import { resetCrossTabSessionForTests } from '../../account/lib/crossTabSession';
import { CheckoutPage } from './CheckoutPage';

let session: SessionStatus = 'signedIn';
vi.mock('../../../shared/auth/useSession', () => ({ useSession: () => session }));

const ITEMS = [
  { productId: 'p-laptop', name: 'Laptop ASUS TUF Gaming A15', price: 24_990_000, quantity: 1 },
];

/** Trả lời POST /orders bằng problem+json với mã nghiệp vụ cho trước */
let orderProblem: { status: number; code: string };
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async () =>
    new Response(JSON.stringify({ title: 'Conflict', code: orderProblem.code }), {
      status: orderProblem.status,
      headers: { 'content-type': 'application/problem+json' },
    }),
);

beforeEach(() => {
  session = 'signedIn';
  resetCrossTabSessionForTests();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

function renderCheckout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/checkout', state: { selectedItems: ITEMS } }]}>
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Điền đủ địa chỉ hợp lệ rồi bấm "Xác nhận đặt hàng" */
function submitValidAddress() {
  const fill = (name: string, value: string) =>
    fireEvent.change(document.querySelector(`[name="${name}"]`)!, { target: { value } });
  fill('fullName', 'Nguyễn Minh Hoàng');
  fill('phone', '0912345678');
  fill('address', '12 Nguyễn Huệ');
  fill('province', 'TP. Hồ Chí Minh');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
}

describe('CheckoutPage: màu thông báo lỗi đặt hàng (dat-hang.md mục 4)', () => {
  it('tooManyOpenOrders_showsWarningAlert_withLinkToOrders', async () => {
    // Arrange (#417)
    orderProblem = { status: 409, code: 'TOO_MANY_OPEN_ORDERS' };
    renderCheckout();

    // Act
    submitValidAddress();

    // Assert: Alert cảnh báo (vàng), không phải lỗi (đỏ), kèm link xem đơn
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bạn đang có 3 đơn chưa giao.');
    expect(alert).toHaveClass(alertStyles.warning!);
    expect(alert).not.toHaveClass(alertStyles.danger!);
    expect(screen.getByRole('link', { name: 'Xem đơn hàng' })).toHaveAttribute('href', '/orders');
    // Verify: đã gửi đúng một lần đặt hàng
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('outOfStock_staysDangerAlert', async () => {
    // Arrange: mã lỗi khác giữ màu lỗi như cũ
    orderProblem = { status: 409, code: 'OUT_OF_STOCK' };
    renderCheckout();

    // Act
    submitValidAddress();

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveClass(alertStyles.danger!);
    expect(alert).not.toHaveClass(alertStyles.warning!);
  });
});

function CartProbe() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('CheckoutPage: chốt chặn trước khi gửi đơn (#508)', () => {
  it('accountSwitchedInOtherTab_doesNotPostOrder_andGoesToCart', async () => {
    // Arrange: trang đặt hàng đang hiện A (token giả, sub giả của bản mock)
    localStorage.setItem('shop-ai:dev-token', 'dev');
    localStorage.setItem('shop-ai:dev-user-id', 'sub-a');
    orderProblem = { status: 409, code: 'OUT_OF_STOCK' };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[{ pathname: '/checkout', state: { selectedItems: ITEMS } }]}>
          <Routes>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/cart" element={<CartProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    // Tab khác đăng nhập B, tin giữa các tab bị lỡ
    localStorage.setItem('shop-ai:dev-user-id', 'sub-b');

    // Act
    submitValidAddress();

    // Assert: không gửi đơn, sang /cart, mục đặt dở đã bỏ, có cờ câu báo
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/cart'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('shop-ai:checkout-items')).toBeNull();
    expect(sessionStorage.getItem('shop-ai:account-switched-notice')).toBe('1');
  });

  it('stuckAfterReload_showsFallbackAlert_andDoesNotPost', async () => {
    // Arrange: đã tải lại vì đổi người mà vẫn lệch
    localStorage.setItem('shop-ai:dev-token', 'dev');
    localStorage.setItem('shop-ai:dev-user-id', 'sub-a');
    renderCheckout();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    // giả trạng thái "tải lại xong vẫn lệch": cờ tải lại trỏ người khác, nạp lại module trạng thái
    sessionStorage.setItem('shop-ai:auth-reload', 'sub-x');
    cleanup();
    resetCrossTabSessionForTests();
    renderCheckout();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    localStorage.setItem('shop-ai:dev-user-id', 'sub-b');

    // Act
    submitValidAddress();

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Tài khoản vừa đổi ở tab khác. Tải lại trang để đặt hàng bằng tài khoản đang đăng nhập.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
