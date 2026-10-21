import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'out'],
  },
  resolve: {
    // Array form so the exact siteDataStore alias is matched before the '@' prefix.
    alias: [
      { find: new RegExp('^@/stores/bn-rrm/siteDataStore$'), replacement: path.resolve(__dirname, 'forked/siteDataStore.ts') },
      { find: new RegExp('^@/stores/bn-rrm/networkStore$'), replacement: path.resolve(__dirname, 'forked/networkStore.ts') },
      { find: '@', replacement: path.resolve(__dirname, '../../src') },
    ],
  },
});
