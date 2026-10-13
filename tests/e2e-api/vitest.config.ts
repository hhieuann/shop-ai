import { defineConfig } from 'vitest/config';

// Biến workflow truyền vào (deploy.yml); thiếu cái nào thì bỏ qua cả bộ (hands-on-testing-guide.md mục 6.2)
const REQUIRED = ['BASE_URL', 'COGNITO_CLIENT_ID', 'E2E_USERNAME', 'E2E_PASSWORD'] as const;
const missing = REQUIRED.filter((name) => !process.env[name]);

if (missing.length > 0) {
  // In thẳng ra stdout (không qua Vitest) để GitHub Actions hiện thành cảnh báo vàng. Chỉ in tên biến.
  process.stdout.write(
    `::warning title=E2E API bị bỏ qua::Thiếu biến ${missing.join(', ')} cho environment này.\n`,
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    // Vite tự đặt process.env.BASE_URL = '/' trong lúc chạy test, đè giá trị của workflow.
    // Đọc ở đây, trước khi bị đè, rồi chuyển cho test qua biến riêng (cùng cách tests/smoke).
    env: {
      E2E_BASE_URL: process.env.BASE_URL ?? '',
      E2E_REGION: process.env.AWS_REGION || 'ap-southeast-1',
      E2E_READY: missing.length === 0 ? '1' : '',
    },
    include: ['*.e2e.ts'],
    // Gọi qua Internet tới CloudFront, Lambda (có thể khởi động lạnh) và Cognito
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Bước giỏ ghi vào giỏ thật của người dùng E2E: chạy lần lượt từng file, không thử lại
    fileParallelism: false,
    retry: 0,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'reports/junit.xml' },
  },
});
