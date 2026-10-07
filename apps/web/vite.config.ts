import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // API_PROXY_TARGET: nơi Vite chuyển /api/* tới khi chạy `pnpm --filter web dev`.
  // Để trống → Prism mock ở máy. Đặt URL API dev (output ApiUrl của stack shop-dev-api) → dữ liệu thật.
  // Đặt bằng biến môi trường hoặc trong apps/web/.env.local (đã gitignore). Không có tiền tố VITE_
  // nên không lọt vào code gửi xuống trình duyệt.
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://localhost:4010';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
