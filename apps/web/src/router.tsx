import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './app/RootLayout';
import { NotFoundPage } from './shared/components/NotFoundPage';

/**
 * Mỗi trang là một file JS riêng, chỉ tải khi người dùng mở trang đó (apps/web/README.md:
 * "Chia code theo trang", JS ban đầu ≤ 250 KB gzip). Khách chỉ xem hàng thì không phải tải
 * code giỏ hàng hay checkout.
 */
export const router = createBrowserRouter([
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
        lazy: async () => ({
          Component: (await import('./features/catalog/pages/ProductListPage')).ProductListPage,
        }),
      },
      {
        path: 'products/:productId',
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
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
