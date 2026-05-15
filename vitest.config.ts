import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    // @ts-expect-error -- vitest documents `postcss: false` as the way to
    // disable postcss, but vite's shared `css` types don't expose `false`
    // as a valid value. Runtime is correct; this suppresses the next-build
    // type-check failure. See https://vitest.dev/config/#css-postcss
    postcss: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'e2e/**',
      '**/e2e/**',
      // Performance tests require a build - run separately with `npm run build && npm test`
      '**/performance.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

