// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import alertStyles from '../../../shared/components/Alert.module.css';
import type { CartItem } from '../../../shared/api/types';
import buttonStyles from '../../../shared/components/Button.module.css';
import emptyStyles from '../../../shared/components/EmptyState.module.css';
import { CartPage } from './CartPage';

// Giỏ của tài khoản đang đăng nhập (B), mặc định rỗng; test đổi `cart.items`. Không gọi API
const cart = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock('../hooks/useCart', () => ({
  useCart: () => ({
    session: 'signedIn',
    isGuest: false,
    status: 'ready',
    items: cart.items,
    update: { isPending: false, isError: false, error: null, mutate: vi.fn() },
    remove: { isPending: false, mutate: vi.fn() },
  }),
  useGuestLines: () => [],
}));

const ITEM: CartItem = {
  productId: '01K6ZKX9M3V8Q2R4T6W8Y0A2C4',
  name: 'Card đồ hoạ thử',
  price: 15_900_000,
  quantity: 1,
  stock: 5,
  status: 'ACTIVE',
};
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

beforeEach(() => {
  sessionStorage.clear();
  cart.items = [];
});
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

describe('CartPage: component dùng chung (EmptyState, Button)', () => {
  it('empty_showsEmptyStateWithLink_andPrimaryContinueButton', () => {
    // Act
    renderCart();

    // Assert: khối rỗng là EmptyState, có link sang danh sách
    const message = screen.getByText(/Chưa có sản phẩm nào trong giỏ/);
    expect(message).toHaveClass(emptyStyles.message!);
    expect(screen.getByRole('link', { name: 'xem tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/products',
    );
    // Nút "Tiếp tục mua sắm" là link kiểu nút chính lg
    const next = screen.getByRole('link', { name: 'Tiếp tục mua sắm' });
    expect(next).toHaveClass(buttonStyles.primary!, buttonStyles.lg!, buttonStyles.block!);
  });

  it('checkout_isPrimaryButton_disabledWhenNothingSelected', () => {
    // Arrange
    cart.items = [ITEM];
    renderCart();
    const [summaryButton] = screen.getAllByRole('button', { name: 'Đặt hàng (1)' });
    expect(summaryButton).toHaveClass(buttonStyles.primary!, buttonStyles.lg!);
    expect(summaryButton).toBeEnabled();

    // Act: bỏ chọn tất cả
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn tất cả/ }));

    // Assert: cả nút ở khối tóm tắt lẫn thanh dính đáy đều vô hiệu
    const buttons = screen.getAllByRole('button', { name: 'Đặt hàng (0)' });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(screen.getByText('Chọn ít nhất 1 sản phẩm để đặt hàng.')).toBeInTheDocument();
  });
});
