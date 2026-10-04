/** TanStack Query key factory — tránh magic string rải rác khắp nơi */
export const queryKeys = {
  products: {
    all: ['products'] as const,
    /** Danh sách có phân trang "Xem thêm" (useInfiniteQuery) */
    list: (params: Record<string, unknown>) => ['products', 'list', params] as const,
    /** Một trang đầu cho carousel trang chủ (useQuery thường; dữ liệu khác hình dạng nên khác key) */
    preview: (params: Record<string, unknown>) => ['products', 'preview', params] as const,
    detail: (productId: string) => ['products', 'detail', productId] as const,
  },
  cart: {
    all: ['cart'] as const,
    mine: () => ['cart', 'mine'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: () => ['orders', 'list'] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  },
} as const;
