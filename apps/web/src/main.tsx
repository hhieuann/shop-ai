import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './queryClient';
import { router } from './router';
// Font Inter tự host (design-system §3): 4 độ đậm đang dùng, dải chữ Latin và tiếng Việt.
// Trình duyệt chỉ tải file của độ đậm và dải ký tự trang dùng tới (unicode-range); font-display: swap
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/vietnamese-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/vietnamese-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/vietnamese-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/vietnamese-700.css';
import './styles/tokens.css';
import './styles/base.css';

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
