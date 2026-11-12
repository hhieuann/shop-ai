import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { RootLayout, type RouteHandle } from './app/RootLayout';
import { productDetailQuery } from './features/catalog/lib/productDetailQuery';
import { queryClient } from './queryClient';
import { NotFoundPage } from './shared/components/NotFoundPage';

/**
 * Mỗi trang là một file JS riêng, chỉ tải khi người dùng mở trang đó (apps/web/README.md:
 * "Chia code theo trang", JS ban đầu ≤ 250 KB gzip). Khách chỉ xem hàng thì không phải tải
 * code giỏ hàng hay checkout. Danh sách route tách riêng để test dựng router trong bộ nhớ.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    // React Router 7: lúc mở web lần đầu, trong khi tải code của trang (lazy route) router chưa vẽ gì.
    // Khai báo rõ điều đó ở đây; thiếu thì router in cảnh báo "No HydrateFallback element" ra console.
    HydrateFallback: () => null,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./features/home/pages/HomePage')).HomePage,
        }),
      },
      {
        path: 'products',
        // Nền trắng, footer sát nội dung (pages/danh-sach-san-pham.md §2)
        handle: { surface: 'plain' } satisfies RouteHandle,
        lazy: async () => ({
          Component: (await import('./features/catalog/pages/ProductListPage')).ProductListPage,
        }),
      },
      {
        path: 'products/:productId',
        // Từ 1280px hàng 2 header thu lại khi cuộn (§3.8); breadcrumb sát header (§2)
        handle: { headerNeeds: 'collapse', flushTop: true } satisfies RouteHandle,
        // Tải dữ liệu sản phẩm song song với code trang (lazy), không chờ (#367): tên sản phẩm (LCP)
        // hiện sớm hơn. prefetchQuery không ném lỗi; 404 hay lỗi API để trang tự báo như cũ
        loader: ({ params }) => {
          if (params.productId)
            void queryClient.prefetchQuery(productDetailQuery(params.productId));
          return null;
        },
        lazy: async () => ({
          Component: (await import('./features/catalog/pages/ProductDetailPage')).ProductDetailPage,
        }),
      },
      {
        path: 'cart',
        lazy: async () => ({
          Component: (await import('./features/cart/pages/CartPage')).CartPage,
        }),
      },
      {
        path: 'checkout',
        // Bố cục tập trung: khách đang điền địa chỉ chỉ có logo và link quay lại giỏ (dat-hang.md §2)
        handle: {
          chrome: 'focus',
          back: { to: '/cart', label: 'Quay lại giỏ hàng' },
        } satisfies RouteHandle,
        lazy: async () => ({
          Component: (await import('./features/orders/pages/CheckoutPage')).CheckoutPage,
        }),
      },
      {
        path: 'orders',
        lazy: async () => ({
          Component: (await import('./features/orders/pages/OrderListPage')).OrderListPage,
        }),
      },
      {
        path: 'orders/:orderId',
        lazy: async () => ({
          Component: (await import('./features/orders/pages/OrderDetailPage')).OrderDetailPage,
        }),
      },
      {
        // Đăng nhập Cognito (dang-nhap.md §3.1)
        path: 'login',
        lazy: async () => ({
          Component: (await import('./features/auth/pages/LoginPage')).LoginPage,
        }),
      },
      {
        // Tạo tài khoản và xác nhận email (dang-nhap.md §3.2, §3.3)
        path: 'register',
        lazy: async () => ({
          Component: (await import('./features/auth/pages/RegisterPage')).RegisterPage,
        }),
      },
      {
        // Quên mật khẩu: nhập email rồi mã + mật khẩu mới (dang-nhap.md §3.4)
        path: 'forgot-password',
        lazy: async () => ({
          Component: (await import('./features/auth/pages/ForgotPasswordPage')).ForgotPasswordPage,
        }),
      },
      {
        // Admin chuyển đơn sang Đang giao, Đã giao (pages/admin-don-hang.md); code tải riêng
        path: 'admin',
        lazy: async () => ({
          Component: (await import('./features/admin/pages/AdminOrdersPage')).AdminOrdersPage,
        }),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
