import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Testcontainers tải image DynamoDB Local ở lần chạy đầu, có thể mất cả phút.
    hookTimeout: 120_000,
    env: {
      POWERTOOLS_LOG_LEVEL: 'SILENT',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
