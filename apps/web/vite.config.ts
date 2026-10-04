import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api/* sang Prism mock server khi dev local
      '/api': {
        target: 'http://localhost:4010',
        changeOrigin: true,
      },
    },
  },
});
