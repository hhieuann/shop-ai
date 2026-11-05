import { QueryClient } from '@tanstack/react-query';
import { shouldRetry } from './shared/api/retry';

/**
 * Một QueryClient cho cả web: QueryClientProvider (main.tsx) và loader của router (router.tsx)
 * dùng chung, để dữ liệu loader tải trước nằm sẵn trong cache khi trang mở ra.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 60 giây — phù hợp với cache CloudFront
      retry: shouldRetry, // lỗi 4xx báo ngay, không gọi lại (shared/api/retry.ts)
    },
  },
});
