// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SessionStatus } from '../../../shared/auth/useSession';
import type { OrderListResponse, OrderSummary } from '../types';
import { OrderDetailPage } from './OrderDetailPage';
import { OrderListPage } from './OrderListPage';

let session: SessionStatus = 'guest';
vi.mock('../../../shared/auth/useSession', () => ({ useSession: () => session }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status < 400 ? 'application/json' : 'application/problem+json' },
  });

const summary = (overrides: Partial<OrderSummary> = {}): OrderSummary => ({
  orderId: '01M4QD8T2H7V9C3X5B1N6R8DWQ',
  status: 'PENDING',
  totalAmount: 30_360_000,
  itemCount: 1,
  firstItemName: 'Laptop ASUS TUF Gaming A15',
  createdAt: '2026-11-09T03:24:00Z',
  ...overrides,
});

/** Trả lời GET /orders theo cursor trên URL; mặc định danh sách rỗng */
let pages: Record<string, OrderListResponse | 'error'> = {};
const fetchMock = vi.fn(async (input: string) => {
  const url = new URL(input, 'http://localhost');
  if (url.pathname.endsWith('/orders')) {
    const page = pages[url.searchParams.get('cursor') ?? ''] ?? { items: [] };
    return page === 'error' ? json({ title: 'Lỗi' }, 500) : json(page);
  }
  return json({ title: 'Not Found' }, 404);
});

/** URL các lần gọi danh sách đơn */
const listCalls = () =>
  fetchMock.mock.calls
    .map(([input]) => new URL(input, 'http://localhost'))
    .filter((url) => url.pathname.endsWith('/orders'));

beforeEach(() => {
  session = 'guest';
  pages = {};
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

    // Assert: giống /checkout, không gọi API rồi hiện lỗi
    expect(await screen.findByText(`Trang đăng nhập, quay lại ${path}`)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loadingSession_showsSkeleton_withoutCallingApiOrRedirecting', () => {
    // Arrange
    session = 'loading';

    // Act
    renderAt('/orders');

    // Assert: khung chờ, không chuyển trang
    expect(screen.getByRole('heading', { level: 1, name: 'Đơn hàng của tôi' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Đang tải đơn hàng' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    // Verify
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Đơn hàng của tôi /orders (pages/don-hang.md mục 3, 5)', () => {
  beforeEach(() => {
    session = 'signedIn';
  });

  it('list_requestsFirstPageOf20', async () => {
    // Act
    renderAt('/orders');
    await screen.findByText('Bạn chưa có đơn hàng nào.');

    // Verify
    const calls = listCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.searchParams.get('limit')).toBe('20');
    expect(calls[0]!.searchParams.has('cursor')).toBe(false);
  });

  it('list_showsEmptyState_withShopLink_whenNoOrders', async () => {
    // Act
    renderAt('/orders');

    // Assert
    expect(await screen.findByText('Bạn chưa có đơn hàng nào.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mua sắm ngay' })).toHaveAttribute('href', '/products');
    expect(screen.queryByRole('button', { name: 'Xem thêm đơn' })).toBeNull();
  });

  it('list_namesOrderByItem_andLinksWholeRowToDetail', async () => {
    // Arrange: đơn 1 món và đơn 3 món
    pages[''] = {
      items: [
        summary({ orderId: 'ORDER1', firstItemName: 'Màn hình LG 27UP850N', itemCount: 1 }),
        summary({
          orderId: 'ORDER3',
          firstItemName: 'Laptop ASUS TUF Gaming A15',
          itemCount: 3,
          status: 'SHIPPED',
          totalAmount: 30_360_000,
        }),
      ],
    };

    // Act
    renderAt('/orders');
    await screen.findAllByRole('link');
    const rows = screen.getAllByRole('listitem');

    // Assert: mỗi dòng đúng một link tới chi tiết đơn
    expect(rows).toHaveLength(2);
    const [one, three] = rows.map((row) => within(row).getByRole('link'));
    expect(within(rows[0]!).getAllByRole('link')).toHaveLength(1);
    expect(one).toHaveAttribute('href', '/orders/ORDER1');
    expect(three).toHaveAttribute('href', '/orders/ORDER3');
    // 1 món: chỉ tên món; 3 món: thêm "và 2 sản phẩm khác"
    expect(one).toHaveTextContent('Màn hình LG 27UP850N');
    expect(one).not.toHaveTextContent('sản phẩm khác');
    // Tên link đọc đủ tên đơn, trạng thái, ngày, số món, mã, tổng tiền
    expect(three).toHaveAccessibleName(
      'Laptop ASUS TUF Gaming A15 và 2 sản phẩm khác Đang giao ' +
        'Đặt lúc 09/11/2026 10:24 · 3 sản phẩm Mã đơn ORDER3 30.360.000 đồng',
    );
  });

  it('list_appendsNextPage_whenClickingLoadMore', async () => {
    // Arrange
    pages[''] = { items: [summary({ orderId: 'A', firstItemName: 'Đơn A' })], nextCursor: 'c2' };
    pages.c2 = { items: [summary({ orderId: 'B', firstItemName: 'Đơn B' })] };
    renderAt('/orders');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm đơn' }));

    // Assert: đơn cũ còn, đơn mới nối vào cuối, hết trang thì ẩn nút
    await screen.findByText('Đơn B');
    const names = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(names).toEqual(['/orders/A', '/orders/B']);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Xem thêm/ })).toBeNull());
    // Verify: lần hai gửi đúng cursor
    const calls = listCalls();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.searchParams.get('cursor')).toBe('c2');
    expect(calls[1]!.searchParams.get('limit')).toBe('20');
  });

  it('list_hidesLoadMore_whenNoNextCursor', async () => {
    pages[''] = { items: [summary()] };

    renderAt('/orders');

    expect(await screen.findByText('Laptop ASUS TUF Gaming A15')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem thêm đơn' })).toBeNull();
  });

  it('list_showsAlert_whenFirstLoadFails', async () => {
    // Arrange
    pages[''] = 'error';

    // Act
    renderAt('/orders');

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được đơn hàng. Tải lại trang để thử lần nữa.',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('list_keepsOrders_whenLoadMoreFails', async () => {
    // Arrange
    pages[''] = { items: [summary({ orderId: 'A', firstItemName: 'Đơn A' })], nextCursor: 'c2' };
    pages.c2 = 'error';
    renderAt('/orders');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm đơn' }));

    // Assert: danh sách còn nguyên, báo lỗi dưới nút, nút vẫn bấm lại được
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải thêm được. Bấm lại để thử lần nữa.',
    );
    expect(screen.getByText('Đơn A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem thêm đơn' })).toBeEnabled();
  });
});
