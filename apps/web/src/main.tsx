import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { shouldRetry } from './shared/api/retry';
import './styles/tokens.css';
import './styles/base.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 60 giây — phù hợp với cache CloudFront
      retry: shouldRetry, // lỗi 4xx báo ngay, không gọi lại (shared/api/retry.ts)
    },
  },
});

// Nạp Cognito (Amplify) ở gói riêng, không chặn trang hiện lên. Có /config.json thì token.ts tự báo đăng nhập đã đổi.
void import('./shared/auth/cognito').then(({ initAuth }) => initAuth());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
