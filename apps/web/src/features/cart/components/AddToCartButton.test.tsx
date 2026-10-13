// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '../../../shared/api/client';
import { LiveAnnouncerProvider } from '../../../shared/components/LiveAnnouncer';
import type { CartAddable } from '../hooks/useCart';
import { ADDED_MS, AddToCartButton, ERROR_MS } from './AddToCartButton';

/** useCart giả: add.mutate gọi lại onSuccess/onError theo kết quả cho trước */
type Outcome = { ok: true } | { ok: false; error: unknown } | 'pending';
let outcome: Outcome = { ok: true };
const mutate = vi.fn();
let isPending = false;

vi.mock('../hooks/useCart', () => ({
  useCart: () => ({
    add: {
      isPending,
      mutate: (vars: unknown, cb: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
        mutate(vars);
        if (outcome === 'pending') return;
        if (outcome.ok) cb.onSuccess?.();
        else cb.onError?.(outcome.error);
      },
    },
  }),
}));

const product: CartAddable = {
  productId: 'p-1',
  name: 'RTX 4060',
  price: 7_990_000,
  stock: 5,
  status: 'ACTIVE',
};

const conflict = (body: Record<string, unknown>) => new ApiError(409, body, 'Conflict');

function renderButton(p: CartAddable = product) {
  return render(
    <LiveAnnouncerProvider>
      <AddToCartButton product={p} />
    </LiveAnnouncerProvider>,
  );
}
const button = () => screen.getByRole('button', { name: 'Thêm RTX 4060 vào giỏ' });

beforeEach(() => {
  vi.useFakeTimers();
  outcome = { ok: true };
  isPending = false;
  mutate.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AddToCartButton', () => {
  it('thành công: thêm đúng 1, hiện "Đã thêm vào giỏ", đọc câu, sau 2 giây về bình thường', () => {
    const { container } = renderButton();
    fireEvent.click(button());

    expect(mutate).toHaveBeenCalledWith({ product, quantity: 1 });
    expect(button()).toHaveTextContent('Đã thêm vào giỏ');
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Đã thêm RTX 4060 vào giỏ.',
    );

    act(() => vi.advanceTimersByTime(ADDED_MS));
    expect(button()).toHaveTextContent('Thêm vào giỏ');
    expect(button()).not.toHaveTextContent('Đã thêm');
  });

  it.each([
    {
      code: 'QUANTITY_LIMIT',
      error: conflict({ code: 'QUANTITY_LIMIT', maxAddable: 0 }),
      label: 'Đã đủ số lượng',
      alert: 'Giỏ đã có số lượng tối đa của sản phẩm này.',
    },
    {
      code: 'CART_FULL',
      error: conflict({ code: 'CART_FULL' }),
      label: 'Giỏ đã đủ 50 món',
      alert: 'Giỏ hàng đã đủ 50 sản phẩm. Hãy đặt hàng hoặc xoá bớt.',
    },
    {
      code: 'PRODUCT_UNAVAILABLE',
      error: conflict({ code: 'PRODUCT_UNAVAILABLE' }),
      label: 'Ngừng bán',
      alert: 'Sản phẩm đã ngừng bán.',
    },
    {
      code: 'lỗi mạng',
      error: new TypeError('Failed to fetch'),
      label: 'Chưa thêm được',
      alert: 'Không kết nối được máy chủ, vui lòng thử lại.',
    },
  ])(
    'lỗi $code: nhãn ngắn trên nút, câu đầy đủ qua role=alert, sau 3 giây về bình thường',
    ({ error, label, alert }) => {
      outcome = { ok: false, error };
      renderButton();
      fireEvent.click(button());

      expect(button()).toHaveTextContent(label);
      expect(screen.getByRole('alert')).toHaveTextContent(alert);

      act(() => vi.advanceTimersByTime(ERROR_MS));
      expect(button()).toHaveTextContent('Thêm vào giỏ');
    },
  );

  it('đang thêm: hiện "Đang thêm…", aria-busy, bấm lần hai không gọi thêm', () => {
    isPending = true;
    outcome = 'pending';
    renderButton();

    expect(button()).toHaveTextContent('Đang thêm…');
    expect(button()).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('hết hàng: nút "Hết hàng" vô hiệu, không gọi thêm', () => {
    renderButton({ ...product, stock: 0 });
    const soldOut = screen.getByRole('button', { name: 'Hết hàng' });
    expect(soldOut).toBeDisabled();
    fireEvent.click(soldOut);
    expect(mutate).not.toHaveBeenCalled();
  });
});
