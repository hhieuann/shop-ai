// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionStatus } from '../../../shared/auth/useSession';
import alertStyles from '../../../shared/components/Alert.module.css';
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
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
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
