import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/core.ts'],
      thresholds: {
        lines: 0.8,
        functions: 0.8,
        branches: 0.8,
        statements: 0.8
      }
    }
  }
});
