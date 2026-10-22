import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Lần synth đầu của mỗi file phải nạp aws-cdk-lib và dựng cả stack; máy CI chạy song song nên chậm hơn máy cá nhân
    testTimeout: 30_000,
  },
});
