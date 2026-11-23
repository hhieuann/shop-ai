// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import alertStyles from '../../../shared/components/Alert.module.css';
import { CartPage } from './CartPage';

// Giỏ của tài khoản đang đăng nhập (B), rỗng; không gọi API
vi.mock('../hooks/useCart', () => ({
  useCart: () => ({
    session: 'signedIn',
    isGuest: false,
    status: 'ready',
    items: [],
    update: { isPending: false, isError: false, error: null },
    remove: { isPending: false },
  }),
  useGuestLines: () => [],
}));
vi.mock('../../home/components/ProductRail', () => ({ ProductRail: () => null }));

const NOTICE =
  'Tài khoản đăng nhập vừa đổi ở tab khác nên đơn đang đặt dở chưa được gửi. Hãy kiểm tra lại giỏ hàng trước khi đặt.';

/** Vẽ trong StrictMode như main.tsx: hàm khởi tạo state chạy hai lần, câu báo vẫn phải hiện */
function renderCart() {
  return render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/cart']}>
          <CartPage />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('CartPage: câu báo đổi tài khoản ở tab khác (#508)', () => {
  it('showsWarningOnce_thenNotAfterReload', () => {
    // Arrange: tab đang đặt hàng thì tab khác đổi người, tab này được chuyển sang /cart
    sessionStorage.setItem('shop-ai:account-switched-notice', '1');

    // Act
    const view = renderCart();

    // Assert: Alert cảnh báo (vàng) ở đầu trang giỏ
    const alert = screen.getByText(NOTICE).closest('[role="alert"]');
    expect(alert).toHaveClass(alertStyles.warning!);
    // Đã hiện thì xoá cờ
    expect(sessionStorage.getItem('shop-ai:account-switched-notice')).toBeNull();

    // Act: F5 (vẽ lại trang từ đầu)
    view.unmount();
    renderCart();

    // Assert: không hiện lại
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('noFlag_noNotice', () => {
    // Act
    renderCart();

    // Assert
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});
