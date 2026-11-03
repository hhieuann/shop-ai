// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SessionStatus } from '../../../shared/auth/useSession';
import { OrderDetailPage } from './OrderDetailPage';
import { OrderListPage } from './OrderListPage';

let session: SessionStatus = 'guest';
vi.mock('../../../shared/auth/useSession', () => ({ useSession: () => session }));

const fetchMock = vi.fn(async (url: string) =>
  url.endsWith('/orders')
    ? new Response(JSON.stringify({ items: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    : new Response(JSON.stringify({ title: 'Not Found' }), { status: 404 }),
);

beforeEach(() => {
  session = 'guest';
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Trang đăng nhập giả: in ra `from` nhận được để kiểm chỗ quay lại sau khi đăng nhập */
function LoginStub() {
  const { state } = useLocation() as { state: { from?: string } | null };
  return <p>Trang đăng nhập, quay lại {state?.from}</p>;
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/orders" element={<OrderListPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/login" element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Trang đơn hàng khi chưa đăng nhập (#316)', () => {
  it.each(['/orders', '/orders/01ORDER'])('guest_redirectsToLogin_withFrom %s', async (path) => {
    // Act
    renderAt(path);

    // Assert: giống /checkout, không gọi API rồi hiện "Không thể tải đơn hàng."
    expect(await screen.findByText(`Trang đăng nhập, quay lại ${path}`)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loadingSession_waits_withoutCallingApiOrRedirecting', () => {
    // Arrange
    session = 'loading';

    // Act
    renderAt('/orders');

    // Assert
    expect(screen.getByText('Đang tải đơn hàng...')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signedIn_loadsOrders', async () => {
    // Arrange
    session = 'signedIn';

    // Act
    renderAt('/orders');

    // Assert
    expect(await screen.findByText(/Bạn chưa có đơn nào/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
