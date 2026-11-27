/** TanStack Query key factory — tránh magic string rải rác khắp nơi */
export const queryKeys = {
  products: {
    all: ['products'] as const,
    /** Một trang của trang danh sách: bộ lọc + cursor của trang đang xem */
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
  admin: {
    all: ['admin'] as const,
    /** Một trang đơn theo trạng thái; cursor của trang đang xem (undefined: trang 1) */
    orders: (status: string, cursor?: string) => ['admin', 'orders', status, cursor ?? ''] as const,
    /** Mọi dữ liệu sản phẩm admin, cả danh sách lẫn chi tiết (tải lại sau khi ẩn, hiện, xoá, khôi phục) */
    productsAll: () => ['admin', 'products'] as const,
    /** Mọi danh sách sản phẩm admin */
    productLists: () => ['admin', 'products', 'list'] as const,
    /** Một trang sản phẩm admin theo bộ lọc trên URL và cursor của trang đang xem */
    products: (params: Record<string, unknown>) => ['admin', 'products', 'list', params] as const,
    /** Một sản phẩm cho trang sửa (#549), kể cả món đã ẩn, đã xoá */
    product: (productId: string) => ['admin', 'products', 'detail', productId] as const,
  },
  account: {
    all: ['account'] as const,
    /** Xác thực hai lớp bật hay tắt của tài khoản có email này (đọc từ Cognito, không qua API) */
    twoFactor: (email: string) => ['account', 'two-factor', email] as const,
  },
  recs: {
    all: ['recs'] as const,
    /** Khác key với for-you: vừa đăng nhập thì gọi API mới, không dùng lại cache hàng bán chạy */
    bestsellers: () => ['recs', 'bestsellers'] as const,
    forYou: () => ['recs', 'for-you'] as const,
    /** Kèm danh sách loại trừ: giỏ đổi thì lấy lại, món vừa thêm không còn trong gợi ý */
    alsoBought: (productId: string, exclude: readonly string[]) =>
      ['recs', 'also-bought', productId, exclude] as const,
  },
} as const;
