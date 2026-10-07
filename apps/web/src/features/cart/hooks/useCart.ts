import { useSyncExternalStore } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Cart, CartItem, Product } from '../../../shared/api/types';
import { useSession } from '../../../shared/auth/useSession';
import {
  addLine,
  loadGuestCart,
  removeLine,
  saveGuestCart,
  setLineQuantity,
  subscribeGuestCart,
  type GuestCartError,
  type GuestCartResult,
  type GuestLine,
} from '../lib/guestCart';

export type CartStatus = 'loading' | 'error' | 'ready';

/** Lỗi của giỏ khách mang cùng mã với API, để nơi hiển thị lỗi chỉ cần xử lý ApiError */
function toApiError(error: GuestCartError): ApiError {
  return new ApiError(409, { ...error, title: 'Không cập nhật được giỏ hàng' }, 'Conflict');
}

function commit(result: GuestCartResult) {
  if (!result.ok) throw toApiError(result.error);
  saveGuestCart(result.lines);
}

/** Giỏ khách trên trình duyệt, tự cập nhật khi giỏ đổi (cả từ tab khác) */
export function useGuestLines(): GuestLine[] {
  return useSyncExternalStore(subscribeGuestCart, loadGuestCart, () => []);
}

/** Dòng giỏ khách + thông tin sản phẩm mới nhất → cùng dạng CartItem với giỏ tài khoản */
function toCartItem(line: GuestLine, product: Product | null): CartItem {
  if (!product) {
    // Sản phẩm không còn trong catalog: hiện như "Ngừng bán" để khách tự xoá (BR-07)
    return {
      productId: line.productId,
      name: 'Sản phẩm không còn bán',
      price: line.addedPrice,
      quantity: line.quantity,
      stock: 0,
      status: 'INACTIVE',
    };
  }
  return {
    productId: product.productId,
    name: product.name,
    imageUrl: product.imageUrl,
    price: product.price,
    quantity: line.quantity,
    stock: product.stock,
    status: product.status,
    priceChanged: product.price !== line.addedPrice,
  };
}

/**
 * Một giỏ hàng cho cả khách vãng lai và khách đã đăng nhập (cart.md BR-01):
 * - chưa đăng nhập: giỏ khách trong localStorage, thông tin sản phẩm lấy từ GET /products/{id}
 * - đã đăng nhập: giỏ tài khoản qua /api/v1/cart
 * Trang giỏ và nút "Thêm vào giỏ" chỉ dùng hook này, không cần biết giỏ nằm ở đâu.
 */
export function useCart() {
  const session = useSession();
  const isGuest = session === 'guest';
  const queryClient = useQueryClient();

  // ── Giỏ tài khoản ──
  const serverCart = useQuery({
    queryKey: queryKeys.cart.mine(),
    queryFn: () => api.get<Cart>('/cart'),
    enabled: session === 'signedIn',
  });

  // ── Giỏ khách ──
  const lines = useGuestLines();
  const products = useQueries({
    queries: (isGuest ? lines : []).map((line) => ({
      queryKey: queryKeys.products.detail(line.productId),
      queryFn: async (): Promise<Product | null> => {
        try {
          return await api.get<Product>(`/products/${line.productId}`);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }
      },
      staleTime: 30_000,
    })),
  });

  let status: CartStatus;
  let items: CartItem[];
  if (session === 'loading') {
    status = 'loading';
    items = [];
  } else if (isGuest) {
    status = products.some((p) => p.isError)
      ? 'error'
      : products.some((p) => p.isPending)
        ? 'loading'
        : 'ready';
    items =
      status === 'ready' ? lines.map((line, i) => toCartItem(line, products[i]?.data ?? null)) : [];
  } else {
    status = serverCart.isError ? 'error' : serverCart.isPending ? 'loading' : 'ready';
    items = serverCart.data?.items ?? [];
  }

  const factsOf = (productId: string) => {
    const item = items.find((i) => i.productId === productId);
    return item ?? { price: 0, stock: 0, status: 'INACTIVE' as const };
  };

  const refreshServer = () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });

  /** Thêm món (cộng dồn). Cần cả sản phẩm để giỏ khách kiểm giới hạn mà không phải gọi lại API */
  const add = useMutation({
    mutationFn: async ({ product, quantity }: { product: Product; quantity: number }) => {
      if (isGuest) return commit(addLine(loadGuestCart(), product.productId, quantity, product));
      const cart = await api.post<Cart>('/cart/items', { productId: product.productId, quantity });
      queryClient.setQueryData(queryKeys.cart.mine(), cart);
    },
  });

  const update = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      if (isGuest) {
        return commit(setLineQuantity(loadGuestCart(), productId, quantity, factsOf(productId)));
      }
      await api.put<Cart>(`/cart/items/${productId}`, { quantity });
    },
    onSettled: () => (isGuest ? undefined : refreshServer()),
  });

  const remove = useMutation({
    mutationFn: async (productId: string) => {
      if (isGuest) return saveGuestCart(removeLine(loadGuestCart(), productId));
      await api.delete(`/cart/items/${productId}`);
    },
    onSuccess: () => (isGuest ? undefined : refreshServer()),
  });

  return { session, isGuest, status, items, add, update, remove };
}
