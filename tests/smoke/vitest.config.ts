import { defineConfig } from 'vitest/config';

if (!process.env.BASE_URL) {
  // Lần deploy đầu của một môi trường chưa biết URL CloudFront nên chưa đặt được biến.
  // In thẳng ra stdout (không qua Vitest) để GitHub Actions hiện thành cảnh báo vàng.
  process.stdout.write(
    '::warning title=Smoke test bị bỏ qua::Chưa đặt biến BASE_URL cho environment này.\n',
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    // Vite tự đặt process.env.BASE_URL = '/' (đường dẫn gốc của Vite) trong lúc chạy test, đè giá trị của workflow.
    // Đọc ở đây, trước khi bị đè, rồi chuyển cho test qua biến riêng.
    env: { SMOKE_BASE_URL: process.env.BASE_URL ?? '' },
    include: ['*.smoke.ts'],
    // Gọi qua Internet tới CloudFront và Lambda (có thể khởi động lạnh)
    testTimeout: 15_000,
    // Một lỗi là đủ biết deploy hỏng; thử lại một lần cho lỗi mạng chập chờn
    retry: 1,
  },
});
