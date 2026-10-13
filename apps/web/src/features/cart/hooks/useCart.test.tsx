// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProductSummary } from '../../../shared/api/types';
import { ApiError } from '../../../shared/api/client';
import { useCart } from './useCart';

const GUEST_CART = 'shop-ai:guest-cart';

/** Sản phẩm như trong GET /products: không có description, createdAt, updatedAt */
const summary: ProductSummary = {
  productId: 'p-gpu-1',
  name: 'Card màn hình MSI GeForce RTX 4060',
  category: 'gpu',
  brand: 'MSI',
  price: 7_990_000,
  stock: 2,
  status: 'ACTIVE',
  specs: { vram: '8GB GDDR6' },
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('useCart.add với sản phẩm rút gọn (thẻ trang danh sách)', () => {
  it('khách chưa đăng nhập: thêm 1 món vào giỏ trên trình duyệt', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isGuest).toBe(true));

    await result.current.add.mutateAsync({ product: summary, quantity: 1 });

    expect(JSON.parse(localStorage.getItem(GUEST_CART) ?? '[]')).toEqual([
      { productId: 'p-gpu-1', quantity: 1, addedPrice: 7_990_000 },
    ]);
  });

  it('vượt tồn kho: báo QUANTITY_LIMIT kèm số còn thêm được, giỏ giữ nguyên', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isGuest).toBe(true));
    await result.current.add.mutateAsync({ product: summary, quantity: 2 });

    const error = await result.current.add
      .mutateAsync({ product: summary, quantity: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'QUANTITY_LIMIT', maxAddable: 0 });
    expect(JSON.parse(localStorage.getItem(GUEST_CART) ?? '[]')[0].quantity).toBe(2);
  });
});
