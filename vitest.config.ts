import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test')
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**'
      ],
      // Ratchet: gate the well-tested pure modules; raise these as coverage grows.
      thresholds: {
        'src/utils/**': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'src/dsp/math.ts': { statements: 95, branches: 90, functions: 100, lines: 95 }
      }
    }
  }
});
