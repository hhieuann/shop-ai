// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import type { Product } from '../../../shared/api/types';
import { AddToCart } from './AddToCart';

/** Hiệu ứng bay giả: chỉ ghi lại lần gọi */
const flyToCart = vi.fn();
vi.mock('../lib/flyToCart', () => ({
  flyToCart: (...args: unknown[]) => flyToCart(...args),
}));

/** useCart giả: trạng thái của mutation thêm giỏ do test đặt, mutate gọi lại onSuccess khi ok */
let state: { isPending: boolean; isSuccess: boolean; isError: boolean; error: unknown };
const mutate = vi.fn();

vi.mock('../hooks/useCart', () => ({
  useCart: () => ({
    add: {
      ...state,
      mutate: (vars: unknown, cb?: { onSuccess?: () => void }) => {
        mutate(vars);
        if (!state.isError) cb?.onSuccess?.();
      },
    },
  }),
}));

const product: Product = {
  productId: '01K8GQ5Z3XM2T9V4B6N8P0R2S4',
  name: 'Card đồ hoạ RTX 4060',
  brand: 'ASUS',
  category: 'gpu',
  price: 7_990_000,
  stock: 3,
  status: 'ACTIVE',
  description: 'Card đồ hoạ 8GB.',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const conflict = (body: Record<string, unknown>) => new ApiError(409, body, 'Conflict');

/** Trang đăng nhập giả: in ra `from` nhận được để kiểm chỗ quay lại sau khi đăng nhập */
function LoginStub() {
  const { state } = useLocation() as { state: { from?: string } | null };
  return <p>Đăng nhập rồi quay lại {state?.from}</p>;
}

function renderBox(p: Product = product) {
  return render(
    <MemoryRouter initialEntries={[`/products/${p.productId}`]}>
      <Routes>
        <Route path="/products/:productId" element={<AddToCart product={p} />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}
const addButton = () => screen.getByRole('button', { name: 'Thêm vào giỏ' });
const increase = () => screen.getByRole('button', { name: `Tăng số lượng ${product.name}` });

beforeEach(() => {
  state = { isPending: false, isSuccess: false, isError: false, error: null };
  mutate.mockClear();
  flyToCart.mockClear();
});
afterEach(cleanup);

describe('AddToCart', () => {
  it('thêm đúng số lượng đã chọn, thành công thì số lượng về 1', () => {
    // Arrange
    renderBox();
    fireEvent.click(increase());
    fireEvent.click(increase());
    expect(screen.getByText('3')).toBeInTheDocument();

    // Act
    fireEvent.click(addButton());

    // Assert
    expect(mutate).toHaveBeenCalledExactlyOnceWith({ product, quantity: 3 });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('không cho chọn quá tồn kho (min(99, stock))', () => {
    renderBox();
    fireEvent.click(increase());
    fireEvent.click(increase());
    expect(increase()).toBeDisabled();
  });

  it('đã thêm: báo thành công kèm link Xem giỏ hàng', () => {
    state.isSuccess = true;
    renderBox();
    expect(screen.getByRole('status')).toHaveTextContent('Đã thêm vào giỏ.');
    expect(screen.getByRole('link', { name: 'Xem giỏ hàng' })).toHaveAttribute('href', '/cart');
  });

  it('đang thêm: nút "Đang thêm…", aria-busy, không bấm được', () => {
    state.isPending = true;
    renderBox();
    const busy = screen.getByRole('button', { name: 'Đang thêm…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).toBeDisabled();
  });

  it('QUANTITY_LIMIT là cảnh báo, kèm số còn thêm được', () => {
    state = { ...state, isError: true, error: conflict({ code: 'QUANTITY_LIMIT', maxAddable: 2 }) };
    renderBox();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Chỉ thêm được tối đa 2 sản phẩm nữa');
    expect(alert.className).toMatch(/warning/);
  });

  it('lỗi khác là lỗi (danger)', () => {
    state = { ...state, isError: true, error: conflict({ code: 'CART_FULL' }) };
    renderBox();
    expect(screen.getByRole('alert').className).toMatch(/danger/);
  });

  it('phiên hết hạn (401): có link Đăng nhập quay lại trang sản phẩm', () => {
    state = { ...state, isError: true, error: new ApiError(401, {}, 'Unauthorized') };
    renderBox();
    expect(screen.getByRole('alert')).toHaveTextContent('Phiên đăng nhập đã hết');
    const login = screen.getByRole('link', { name: 'Đăng nhập' });
    expect(login).toHaveAttribute('href', '/login');

    // Verify: bấm link thì trang đăng nhập nhận đúng trang để quay lại
    fireEvent.click(login);
    expect(
      screen.getByText(`Đăng nhập rồi quay lại /products/${product.productId}`),
    ).toBeInTheDocument();
  });

  it('hết hàng: không có bộ chọn số lượng, nút "Hết hàng" vô hiệu', () => {
    renderBox({ ...product, stock: 0 });
    expect(screen.queryByText('Số lượng')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hết hàng' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Thêm vào giỏ' })).toBeNull();
  });

  it('thêm thành công: ô bay xuất phát từ nút "Thêm vào giỏ", mang loại hàng', () => {
    renderBox();
    fireEvent.click(addButton());
    expect(flyToCart).toHaveBeenCalledExactlyOnceWith(addButton(), 'gpu');
  });

  it('thêm lỗi: không có ô bay', () => {
    state = { ...state, isError: true, error: conflict({ code: 'CART_FULL' }) };
    renderBox();
    fireEvent.click(addButton());
    expect(flyToCart).not.toHaveBeenCalled();
  });
});
