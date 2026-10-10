import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.service.ts', 'src/**/*.rules.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
